// ===== GAME LOGIC =====
// This file is the brain of Pokémon Chess.
// It handles the board, clicks, moves, and talks to chess.js for the rules.

import { Chess } from 'https://esm.sh/chess.js';
import { KANTO_TEAM, REGIONS, getPokemonImageUrl, getPixelSpriteUrl, BACK_ROW, PIECE_RULES, PIECE_RULE_DESCRIPTIONS } from './pokemon.js';
import { ALL_POKEMON } from './pokemon-data.js';

// --- Settings ---
let currentTeam = { ...KANTO_TEAM };
let currentRegionId = "kanto";
let teamCustomized = false; // true once the player picks a custom Pokémon
let artStyle = "pixel"; // "pixel" or "official"
let soundEnabled = false; // toggled in Settings

// --- AI Opponent ---
let gameMode = "friend";      // "friend" or "computer"
let difficulty = "medium";     // "easy", "medium", "hard"
let isComputerTurn = false;    // true while the computer is "thinking"
let computerTimeout = null;    // tracks the thinking timer so we can cancel it


// --- Pokémon Cries ---
// Plays a Pokémon's cry sound effect using free audio files from PokeAPI.
// Only plays if sound is enabled in Settings.

function playCry(pokemonId) {
    if (!soundEnabled) return;
    const url = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`;
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(() => {
        // Browser may block audio until the user has interacted with the page.
        // That's fine, just skip it silently.
    });
}

// --- Chess Engine ---
// chess.js is a library that knows ALL the chess rules.
// It tracks the board, knows which moves are legal, detects check/checkmate, etc.
const chess = new Chess();

// --- Game State ---
// selectedSquare: the chess square the player clicked on (like "e2")
// validMoves: the list of squares the selected piece can move to
let selectedSquare = null;
let validMoves = [];

// isAnimating: true while a piece is sliding. We block clicks during this.
let isAnimating = false;

// pendingPromotion: when a pawn reaches the last row, we save the move here
// and show a popup so the player can choose Queen, Rook, Bishop, or Knight.
let pendingPromotion = null;

// isReviewing: true when the player is stepping through the game's moves
let isReviewing = false;

// reviewMoves: the list of moves from the finished game (saved for review)
let reviewMoves = [];

// reviewIndex: which move we're currently looking at (0 = starting position)
let reviewIndex = 0;

// reviewChess: a separate chess engine used just for replaying the game
let reviewChess = null;

// --- Piece Type Names ---
// chess.js uses single letters for pieces. We need the full names.
const PIECE_TYPE_NAMES = {
    k: "king",
    q: "queen",
    r: "rook",
    b: "bishop",
    n: "knight",
    p: "pawn",
};

// --- Convert between chess notation and our grid ---
// Chess uses letters and numbers like "a1", "e4".
// Our grid uses row (0-7) and col (0-7).

// Turn a row and column into a chess square name (like "e2")
function toSquareName(row, col) {
    const colLetter = "abcdefgh"[col];
    const rowNumber = 8 - row;
    return colLetter + rowNumber;
}

// Turn a chess square name (like "e2") back into row and column numbers
function fromSquareName(squareName) {
    const col = "abcdefgh".indexOf(squareName[0]);
    const row = 8 - parseInt(squareName[1]);
    return { row, col };
}

// --- Slide Animation ---
// Makes a piece slide smoothly from one square to another.
// fromSq and toSq are square names like "e2" and "e4".
// callback runs after the slide finishes.

function animateMove(fromSq, toSq, callback) {
    isAnimating = true;

    // Figure out the pixel distance between the two squares.
    // Each square is 70px wide and 70px tall.
    const from = fromSquareName(fromSq);
    const to = fromSquareName(toSq);
    const deltaX = (to.col - from.col) * 70;
    const deltaY = (to.row - from.row) * 70;

    // Find the piece image on the starting square.
    // The squares are in a grid, so the starting square is at index (row * 8 + col).
    const boardElement = document.getElementById("board");
    const squareIndex = from.row * 8 + from.col;
    const startSquare = boardElement.children[squareIndex];
    const img = startSquare.querySelector(".piece-image");
    const bar = startSquare.querySelector(".team-bar");

    if (!img) {
        // No image found (shouldn't happen), just skip the animation
        isAnimating = false;
        callback();
        return;
    }

    // Let the piece escape its square so it can slide across the board
    startSquare.classList.add("animating");

    // Set up the smooth slide (0.3 seconds)
    img.style.position = "relative";
    img.style.zIndex = "10";
    img.style.transition = "transform 0.3s ease-in-out";

    // Hide the team bar during the slide so it doesn't look weird
    if (bar) {
        bar.style.display = "none";
    }

    // After a tiny delay (so the browser sees the transition property),
    // move the piece to its destination
    requestAnimationFrame(() => {
        img.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });

    // When the slide finishes, redraw the board and unlock clicks
    let finished = false;
    function onFinish() {
        if (finished) return; // Only run once
        finished = true;
        isAnimating = false;
        callback();
    }

    img.addEventListener("transitionend", onFinish, { once: true });

    // Safety fallback: if transitionend never fires (can happen sometimes),
    // run the callback after 400ms anyway so the game doesn't get stuck
    setTimeout(onFinish, 400);
}

// --- Get Pokémon info for a chess.js piece ---
// chess.js tells us the piece type (k, q, r, b, n, p) and color (w, b).
// We need to look up which Pokémon that piece is.
function getPokemonForPiece(piece) {
    const typeName = PIECE_TYPE_NAMES[piece.type];
    return currentTeam[typeName];
}

// --- Render the Board ---
// This function draws the entire board from scratch.
// It reads the current position from chess.js and draws it.

function renderBoard() {
    const boardElement = document.getElementById("board");
    boardElement.innerHTML = "";

    // Use the review engine when reviewing, otherwise the real game engine
    const activeChess = isReviewing ? reviewChess : chess;

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement("div");
            square.classList.add("square");

            // Alternate colors
            if ((row + col) % 2 === 0) {
                square.classList.add("light");
            } else {
                square.classList.add("dark");
            }

            // Get the chess square name for this position
            const squareName = toSquareName(row, col);

            // Is this square selected? (not during review)
            if (!isReviewing && squareName === selectedSquare) {
                square.classList.add("selected");
            }

            // Is this square a valid move destination? (not during review)
            if (!isReviewing && validMoves.includes(squareName)) {
                square.classList.add("valid-move");
            }

            // Ask the chess engine what piece is on this square
            const piece = activeChess.get(squareName);

            if (piece) {
                const img = document.createElement("img");
                const pokemon = getPokemonForPiece(piece);
                const isShiny = piece.color === "b"; // black = shiny
                img.src = getPokemonImageUrl(pokemon.id, artStyle, isShiny);
                img.alt = pokemon.name;
                img.classList.add("piece-image");
                square.appendChild(img);

                // Add a small colored bar so you can tell White from Black
                const bar = document.createElement("div");
                bar.classList.add("team-bar");
                bar.classList.add(piece.color === "w" ? "white-team" : "black-team");
                square.appendChild(bar);
            }

            // If this square has a King that is in check, highlight it red
            if (piece && piece.type === "k" && activeChess.inCheck() && piece.color === activeChess.turn()) {
                square.classList.add("in-check");
            }

            // When this square is clicked, handle it
            square.addEventListener("click", () => handleSquareClick(squareName));

            boardElement.appendChild(square);
        }
    }

    // Update the turn indicator
    updateTurnIndicator();
}

// --- Execute a Move with Animation ---
// Handles the slide animation, chess.js move, cry, render, and game-over check.
// extraOptions can include { promotion: "q" } for pawn promotion moves.

function executeMove(fromSquare, toSquare, extraOptions, movingPokemon) {
    const moveOptions = { from: fromSquare, to: toSquare, ...extraOptions };

    animateMove(fromSquare, toSquare, () => {
        chess.move(moveOptions);
        playCry(movingPokemon.id);
        renderBoard();
        updateInfoPanel(null);
        checkGameOver();

        if (gameMode === "computer" && !chess.isGameOver()) {
            triggerComputerMove();
        }
    });
}

// --- Pawn Promotion UI ---
// Shows a popup with 4 choices (Queen, Rook, Bishop, Knight) using the team's Pokemon sprites.

function showPromotionOverlay(pawnColor) {
    const isShiny = pawnColor === "b";

    const promotionPieces = [
        { letter: "q", teamKey: "queen" },
        { letter: "r", teamKey: "rook" },
        { letter: "b", teamKey: "bishop" },
        { letter: "n", teamKey: "knight" },
    ];

    for (const p of promotionPieces) {
        const pokemon = currentTeam[p.teamKey];
        const img = document.getElementById("promo-sprite-" + p.letter);
        img.src = getPokemonImageUrl(pokemon.id, artStyle, isShiny);
        img.alt = pokemon.name;
    }

    document.getElementById("promotion-overlay").classList.remove("hidden");
}

function completePromotion(promotionLetter) {
    document.getElementById("promotion-overlay").classList.add("hidden");

    if (!pendingPromotion) return;

    const { fromSquare, toSquare, movingPokemon } = pendingPromotion;

    selectedSquare = null;
    validMoves = [];
    pendingPromotion = null;

    executeMove(fromSquare, toSquare, { promotion: promotionLetter }, movingPokemon);
}

// --- Handle Square Clicks ---
// This is the most important function. It decides what happens when you click.

function handleSquareClick(squareName) {
    // Don't allow clicks while a piece is sliding, during review, computer's turn, or promotion choice
    if (isAnimating || isReviewing || isComputerTurn || pendingPromotion) return;

    const piece = chess.get(squareName);
    const currentTurn = chess.turn(); // "w" for white, "b" for black

    // CASE 1: A piece is already selected, and we clicked on a valid move destination
    if (selectedSquare && validMoves.includes(squareName)) {
        // Remember where we're moving from before we clear it
        const fromSquare = selectedSquare;

        // Check if this is a pawn reaching the other end (promotion)
        const movingPiece = chess.get(fromSquare);

        if (movingPiece && movingPiece.type === "p") {
            const targetRow = squareName[1];
            if ((movingPiece.color === "w" && targetRow === "8") ||
                (movingPiece.color === "b" && targetRow === "1")) {
                // Save the move details and show the promotion choice popup
                pendingPromotion = {
                    fromSquare: fromSquare,
                    toSquare: squareName,
                    movingPiece: movingPiece,
                    movingPokemon: getPokemonForPiece(movingPiece),
                };
                showPromotionOverlay(movingPiece.color);
                return;
            }
        }

        // Clear the selection visually
        selectedSquare = null;
        validMoves = [];

        // Remember the moving Pokémon so we can play its cry after the slide
        const movingPokemon = getPokemonForPiece(movingPiece);

        // Slide the piece to its new square, then update the board
        executeMove(fromSquare, squareName, {}, movingPokemon);
        return;
    }

    // CASE 2: We clicked on one of our own pieces. Select it!
    if (piece && piece.color === currentTurn) {
        selectedSquare = squareName;

        // Ask chess.js for all legal moves from this square
        const moves = chess.moves({ square: squareName, verbose: true });
        validMoves = moves.map(move => move.to);

        // Update the info panel with this Pokémon's info
        const pokemon = getPokemonForPiece(piece);
        const pieceTypeName = PIECE_TYPE_NAMES[piece.type];
        updateInfoPanel({
            name: pokemon.name,
            dexNum: pokemon.dexNum,
            pieceType: pieceTypeName,
            color: piece.color === "w" ? "White" : "Black",
        });

        // Redraw the board to show the selection and valid moves
        renderBoard();
        return;
    }

    // CASE 3: We clicked on an empty square or opponent's piece (not a valid move)
    // Clear the selection
    selectedSquare = null;
    validMoves = [];
    updateInfoPanel(null);
    renderBoard();
}

// --- Update the Info Panel ---
// Shows the selected Pokémon's name, Pokédex number, and chess piece role.

function updateInfoPanel(info) {
    const panel = document.getElementById("info-panel");

    if (!info) {
        panel.innerHTML = '<span class="info-hint">Click a Pokémon to see its info</span>';
        return;
    }

    // Capitalize the piece type (e.g., "king" -> "King")
    const pieceLabel = info.pieceType.charAt(0).toUpperCase() + info.pieceType.slice(1);

    panel.innerHTML = `
        <span class="info-name">${info.name}</span>
        <span class="info-dex">#${info.dexNum}</span>
        <span class="info-piece">${pieceLabel}</span>
    `;
}

// --- Update the Turn Indicator ---
// Shows whose turn it is at the top of the page.

function updateTurnIndicator() {
    const indicator = document.getElementById("turn-indicator");
    const activeChess = isReviewing ? reviewChess : chess;

    if (isReviewing) {
        indicator.textContent = "Reviewing Game";
        indicator.className = "turn-indicator turn-white";
    } else if (activeChess.turn() === "w") {
        indicator.textContent = gameMode === "computer" ? "Your Turn" : "White's Turn";
        indicator.className = "turn-indicator turn-white";
    } else {
        if (gameMode === "computer") {
            indicator.textContent = "Computer is thinking...";
            indicator.className = "turn-indicator turn-black thinking";
        } else {
            indicator.textContent = "Black's Turn";
            indicator.className = "turn-indicator turn-black";
        }
    }
}

// --- Check if the Game is Over ---
// After every move, we ask chess.js if the game has ended.

function checkGameOver() {
    if (chess.isCheckmate()) {
        // The current player is in checkmate, so the OTHER player wins.
        // chess.turn() returns whose turn it is (the player who is stuck).
        const winner = chess.turn() === "w" ? "black" : "white";
        recordGameResult(winner);
        if (gameMode === "computer") {
            // In computer mode, White is the player, Black is the computer
            showGameOver("Checkmate!", winner === "white" ? "You win!" : "You lose!");
        } else {
            const winnerLabel = winner === "white" ? "White" : "Black";
            showGameOver("Checkmate!", winnerLabel + " wins!");
        }
    } else if (chess.isStalemate()) {
        recordGameResult("draw");
        showGameOver("Stalemate!", gameMode === "computer" ? "Draw! No legal moves left." : "It's a draw. No legal moves left.");
    } else if (chess.isDraw()) {
        recordGameResult("draw");
        showGameOver("Draw!", "The game is a draw.");
    } else if (chess.isGameOver()) {
        recordGameResult("draw");
        showGameOver("Game Over!", "The game has ended.");
    }
}

// --- Show the Game Over Popup ---

function showGameOver(title, message) {
    // Game is over, no need to keep the save
    clearSave();
    document.getElementById("game-over-title").textContent = title;
    document.getElementById("game-over-message").textContent = message;
    document.getElementById("game-over-overlay").classList.remove("hidden");
}

// --- Review Mode ---
// Lets players step through all the moves of a finished game.
// We create a separate chess engine and replay moves one at a time.

function startReview() {
    // Save the moves from the finished game
    reviewMoves = chess.history();

    // Create a fresh chess engine to replay moves on
    reviewChess = new Chess();
    reviewIndex = 0;
    isReviewing = true;

    // Hide the game over popup
    document.getElementById("game-over-overlay").classList.add("hidden");

    // Show the review controls and hide the new game button
    document.getElementById("review-controls").classList.remove("hidden");
    document.getElementById("new-game-btn").classList.add("hidden");

    // Update the counter and buttons
    updateReviewControls();

    // Show the starting position
    renderBoard();
    updateInfoPanel(null);
}

function exitReview() {
    isReviewing = false;
    reviewChess = null;
    reviewMoves = [];
    reviewIndex = 0;

    // Hide the review controls and show the new game button
    document.getElementById("review-controls").classList.add("hidden");
    document.getElementById("new-game-btn").classList.remove("hidden");

    // Redraw the board with the real game state
    renderBoard();
}

// Step forward one move
function reviewForward() {
    if (reviewIndex < reviewMoves.length) {
        reviewChess.move(reviewMoves[reviewIndex]);
        reviewIndex++;
        updateReviewControls();
        renderBoard();
    }
}

// Step backward one move
function reviewBack() {
    if (reviewIndex > 0) {
        reviewChess.undo();
        reviewIndex--;
        updateReviewControls();
        renderBoard();
    }
}

// Jump to the very beginning
function reviewGoToStart() {
    reviewChess = new Chess();
    reviewIndex = 0;
    updateReviewControls();
    renderBoard();
}

// Jump to the very end
function reviewGoToEnd() {
    // Replay all remaining moves
    while (reviewIndex < reviewMoves.length) {
        reviewChess.move(reviewMoves[reviewIndex]);
        reviewIndex++;
    }
    updateReviewControls();
    renderBoard();
}

// Update the move counter and enable/disable buttons
function updateReviewControls() {
    document.getElementById("review-counter").textContent =
        `Move ${reviewIndex} / ${reviewMoves.length}`;

    // Disable back buttons at the start, forward buttons at the end
    document.getElementById("review-start").disabled = (reviewIndex === 0);
    document.getElementById("review-back").disabled = (reviewIndex === 0);
    document.getElementById("review-forward").disabled = (reviewIndex === reviewMoves.length);
    document.getElementById("review-end").disabled = (reviewIndex === reviewMoves.length);
}

// --- AI Move Logic ---
// These functions pick a move for the computer player.
// No external APIs: everything runs in the browser using math.

// Piece values for evaluating captures and board positions
const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

// --- Easy AI: Random Move ---
// Just picks any legal move at random. Fun and unpredictable!
function getEasyMove() {
    const moves = chess.moves({ verbose: true });
    return moves[Math.floor(Math.random() * moves.length)];
}

// --- Medium AI: Capture-Seeking ---
// Prefers capturing high-value pieces and avoids leaving its own pieces hanging.
function getMediumMove() {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    // Separate captures from non-captures
    const captures = moves.filter(m => m.captured);
    const nonCaptures = moves.filter(m => !m.captured);

    // Score each capture by target value minus attacker value (prefer trading up)
    if (captures.length > 0) {
        captures.sort((a, b) => {
            const scoreA = PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] * 0.1;
            const scoreB = PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] * 0.1;
            return scoreB - scoreA;
        });
        return captures[0];
    }

    // No captures available: pick a random non-capture move,
    // but try to avoid moves that leave the piece hanging
    const safeMoves = nonCaptures.filter(m => !isHanging(m));
    if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
    }

    // All moves leave something hanging, just pick randomly
    return nonCaptures[Math.floor(Math.random() * nonCaptures.length)];
}

// Check if a move leaves the moved piece where it can be captured for free
function isHanging(move) {
    chess.move(move);
    const responses = chess.moves({ verbose: true });
    const hanging = responses.some(r => r.to === move.to);
    chess.undo();
    return hanging;
}

// --- Hard AI: Minimax with Alpha-Beta Pruning ---
// Looks 3 moves ahead and picks the best position using chess strategy.

// Piece-square tables tell the AI which squares are good for each piece.
// Positive numbers mean that square is good. These are from Black's perspective.
const PIECE_SQUARE_TABLES = {
    p: [ // Pawns: advance and control the center
         0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
         5,  5, 10, 25, 25, 10,  5,  5,
         0,  0,  0, 20, 20,  0,  0,  0,
         5, -5,-10,  0,  0,-10, -5,  5,
         5, 10, 10,-20,-20, 10, 10,  5,
         0,  0,  0,  0,  0,  0,  0,  0,
    ],
    n: [ // Knights: best in the center, bad on the edges
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50,
    ],
    b: [ // Bishops: diagonals and center
        -20,-10,-10,-10,-10,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10,  5,  5, 10, 10,  5,  5,-10,
        -10,  0, 10, 10, 10, 10,  0,-10,
        -10, 10, 10, 10, 10, 10, 10,-10,
        -10,  5,  0,  0,  0,  0,  5,-10,
        -20,-10,-10,-10,-10,-10,-10,-20,
    ],
    r: [ // Rooks: 7th rank is great, open files
         0,  0,  0,  0,  0,  0,  0,  0,
         5, 10, 10, 10, 10, 10, 10,  5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
        -5,  0,  0,  0,  0,  0,  0, -5,
         0,  0,  0,  5,  5,  0,  0,  0,
    ],
    q: [ // Queen: center is good but don't come out too early
        -20,-10,-10, -5, -5,-10,-10,-20,
        -10,  0,  0,  0,  0,  0,  0,-10,
        -10,  0,  5,  5,  5,  5,  0,-10,
         -5,  0,  5,  5,  5,  5,  0, -5,
          0,  0,  5,  5,  5,  5,  0, -5,
        -10,  5,  5,  5,  5,  5,  0,-10,
        -10,  0,  5,  0,  0,  0,  0,-10,
        -20,-10,-10, -5, -5,-10,-10,-20,
    ],
    k: [ // King: stay safe in the corner during middlegame
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20,
        -10,-20,-20,-20,-20,-20,-20,-10,
         20, 20,  0,  0,  0,  0, 20, 20,
         20, 30, 10,  0,  0, 10, 30, 20,
    ],
};

// Evaluate the board position: positive = good for Black (computer)
function evaluateBoard() {
    let score = 0;
    const board = chess.board();
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (!piece) continue;

            // Base piece value
            let pieceScore = PIECE_VALUES[piece.type] * 100;

            // Add positional bonus from piece-square tables
            const table = PIECE_SQUARE_TABLES[piece.type];
            if (piece.color === "b") {
                // Black: read the table top-to-bottom (as written)
                pieceScore += table[row * 8 + col];
            } else {
                // White: flip the table so row 0 becomes row 7
                pieceScore += table[(7 - row) * 8 + col];
            }

            // Add score for Black pieces, subtract for White
            if (piece.color === "b") {
                score += pieceScore;
            } else {
                score -= pieceScore;
            }
        }
    }
    return score;
}

// Minimax with alpha-beta pruning
// depth: how many moves ahead to look
// alpha: best score Black can guarantee so far
// beta: best score White can guarantee so far
// isMaximizing: true when it's Black's turn (computer wants to maximize)
function minimax(depth, alpha, beta, isMaximizing) {
    if (depth === 0 || chess.isGameOver()) {
        return evaluateBoard();
    }

    const moves = chess.moves({ verbose: true });

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of moves) {
            chess.move(move);
            const score = minimax(depth - 1, alpha, beta, false);
            chess.undo();
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Prune: White won't allow this
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of moves) {
            chess.move(move);
            const score = minimax(depth - 1, alpha, beta, true);
            chess.undo();
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Prune: Black won't allow this
        }
        return minScore;
    }
}

function getHardMove() {
    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return null;

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
        chess.move(move);
        // Computer is Black (maximizing), so after computer moves it's White's turn (minimizing)
        const score = minimax(2, -Infinity, Infinity, false); // depth 2 more = 3 total
        chess.undo();

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }
    return bestMove;
}

// --- Trigger Computer Move ---
// Called after the human player moves. Waits 1-2 seconds, then makes the AI move.

function triggerComputerMove() {
    if (chess.isGameOver()) return;

    isComputerTurn = true;
    updateTurnIndicator();

    // Random delay between 1 and 2 seconds so it feels like "thinking"
    const delay = 1000 + Math.random() * 1000;

    computerTimeout = setTimeout(() => {
        // Pick a move based on difficulty
        let move;
        if (difficulty === "easy") {
            move = getEasyMove();
        } else if (difficulty === "medium") {
            move = getMediumMove();
        } else {
            move = getHardMove();
        }

        if (!move) {
            // No legal moves (game should already be over, but just in case)
            isComputerTurn = false;
            updateTurnIndicator();
            return;
        }

        // Check if this is a pawn promotion
        const moveOptions = { from: move.from, to: move.to };
        if (move.promotion) {
            moveOptions.promotion = move.promotion;
        }

        // Remember the Pokémon for the cry
        const movingPiece = chess.get(move.from);
        const movingPokemon = getPokemonForPiece(movingPiece);

        // Slide the piece, then update
        animateMove(move.from, move.to, () => {
            chess.move(moveOptions);
            playCry(movingPokemon.id);
            isComputerTurn = false;
            renderBoard();
            updateInfoPanel(null);
            checkGameOver();
        });
    }, delay);
}

// --- Screen Navigation ---
// The website has multiple screens (menu, mode select, rules, game).
// Only one screen shows at a time. This function switches between them.

function showScreen(screenId) {
    // Find all screens and hide them
    const screens = document.querySelectorAll(".screen");
    screens.forEach(screen => screen.classList.add("hidden"));

    // Show the one we want
    document.getElementById(screenId).classList.remove("hidden");
}

// Start a new game and show the game board
function startGame() {
    chess.reset();
    selectedSquare = null;
    validMoves = [];
    isReviewing = false;
    isComputerTurn = false;
    pendingPromotion = null;
    reviewChess = null;
    reviewMoves = [];
    reviewIndex = 0;

    // Starting a new game clears any saved progress
    clearSave();

    // Make sure review controls are hidden and main menu button is visible
    document.getElementById("review-controls").classList.add("hidden");
    document.getElementById("new-game-btn").classList.remove("hidden");

    // Hide the game over popup and promotion popup
    document.getElementById("game-over-overlay").classList.add("hidden");
    document.getElementById("promotion-overlay").classList.add("hidden");

    // Clear the info panel
    updateInfoPanel(null);

    // Switch to the game screen and draw the board
    showScreen("game-screen");
    renderBoard();
}

// Go back to the main menu
function goToMenu() {
    // Cancel any pending computer move
    if (computerTimeout) {
        clearTimeout(computerTimeout);
        computerTimeout = null;
    }
    isComputerTurn = false;
    pendingPromotion = null;
    document.getElementById("promotion-overlay").classList.add("hidden");

    // Exit review mode if we're in it
    if (isReviewing) {
        isReviewing = false;
        reviewChess = null;
        reviewMoves = [];
        reviewIndex = 0;
        document.getElementById("review-controls").classList.add("hidden");
        document.getElementById("new-game-btn").classList.remove("hidden");
    }

    // Hide game over popup if it's open
    document.getElementById("game-over-overlay").classList.add("hidden");

    showScreen("menu-screen");

    // Show a new fun fact each time you return to the menu
    showRandomFunFact();

    // Check if there's a saved game to show the Continue button
    updateContinueButton();
}

// --- Save & Load Game ---
// Saves the current game to the browser's localStorage so players can quit
// and come back later without losing their progress.

function saveGame() {
    const saveData = {
        // The move history is all we need to recreate the exact board position
        moves: chess.history(),
        // Remember which region was selected
        regionId: currentRegionId,
        artStyle: artStyle,
        // Save the custom team (in case the player swapped Pokémon)
        customTeam: currentTeam,
        // Save game mode and difficulty so computer games can be resumed
        gameMode: gameMode,
        difficulty: difficulty,
    };
    localStorage.setItem("pokemonChessSave", JSON.stringify(saveData));
}

// Check if there's a saved game
function hasSavedGame() {
    return localStorage.getItem("pokemonChessSave") !== null;
}

// Load a saved game and resume playing
function loadGame() {
    const raw = localStorage.getItem("pokemonChessSave");
    if (!raw) return;

    const saveData = JSON.parse(raw);

    // Restore the region and team
    if (saveData.regionId && REGIONS[saveData.regionId]) {
        currentRegionId = saveData.regionId;
        const region = REGIONS[currentRegionId];
        currentMascots = region.mascots;
    }
    // Restore the custom team if saved, otherwise use region default
    if (saveData.customTeam) {
        currentTeam = saveData.customTeam;
        teamCustomized = true;
    } else {
        currentTeam = { ...REGIONS[currentRegionId].team };
        teamCustomized = false;
    }

    // Restore the art style
    if (saveData.artStyle) {
        artStyle = saveData.artStyle;
        const toggle = document.getElementById("art-style-toggle");
        if (artStyle === "official") {
            toggle.checked = true;
            document.getElementById("toggle-pixel").classList.remove("active");
            document.getElementById("toggle-hd").classList.add("active");
        } else {
            toggle.checked = false;
            document.getElementById("toggle-pixel").classList.add("active");
            document.getElementById("toggle-hd").classList.remove("active");
        }
    }

    // Reset the chess engine and replay all the saved moves
    chess.reset();
    for (const move of saveData.moves) {
        chess.move(move);
    }

    // Restore game mode and difficulty
    gameMode = saveData.gameMode || "friend";
    difficulty = saveData.difficulty || "medium";

    // Set up the game state
    selectedSquare = null;
    validMoves = [];
    isReviewing = false;
    isComputerTurn = false;
    reviewChess = null;
    reviewMoves = [];
    reviewIndex = 0;

    document.getElementById("review-controls").classList.add("hidden");
    document.getElementById("game-over-overlay").classList.add("hidden");
    updateInfoPanel(null);

    // Show the game board with the restored position
    showScreen("game-screen");
    renderBoard();

    // If it's the computer's turn, trigger the AI move
    if (gameMode === "computer" && chess.turn() === "b" && !chess.isGameOver()) {
        triggerComputerMove();
    }
}

// Delete the saved game (called when a game ends naturally or a new game starts)
function clearSave() {
    localStorage.removeItem("pokemonChessSave");
    updateContinueButton();
}

// Save the game and go back to the menu
function saveAndQuit() {
    saveGame();
    goToMenu();
}

// Show or hide the Continue button on the main menu
function updateContinueButton() {
    const btn = document.getElementById("menu-continue-btn");
    if (hasSavedGame()) {
        btn.classList.remove("hidden");
    } else {
        btn.classList.add("hidden");
    }
}

// --- Player Stats ---
// Tracks games played, wins, losses, and draws in localStorage.

function getStats() {
    const raw = localStorage.getItem("pokemonChessStats");
    if (!raw) return { gamesPlayed: 0, wins: 0, losses: 0, draws: 0 };
    return JSON.parse(raw);
}

function saveStats(stats) {
    localStorage.setItem("pokemonChessStats", JSON.stringify(stats));
}

// Record the result of a finished game.
// result is "white", "black", or "draw".
function recordGameResult(result) {
    const stats = getStats();
    stats.gamesPlayed++;
    if (result === "draw") {
        stats.draws++;
    } else if (result === "white") {
        // White won (player 1)
        stats.wins++;
    } else {
        // Black won (player 2)
        stats.losses++;
    }
    saveStats(stats);
    updateStatsDisplay();
}

// Update the stats display on the main menu
function updateStatsDisplay() {
    const stats = getStats();
    document.getElementById("stats-games").textContent = stats.gamesPlayed;
    document.getElementById("stats-wins").textContent = stats.wins;
    document.getElementById("stats-losses").textContent = stats.losses;
    document.getElementById("stats-draws").textContent = stats.draws;

    // Calculate win percentage
    if (stats.gamesPlayed > 0) {
        const winPct = Math.round((stats.wins / stats.gamesPlayed) * 100);
        document.getElementById("stats-win-pct").textContent = winPct + "%";
    } else {
        document.getElementById("stats-win-pct").textContent = "--";
    }
}

// --- Region Selection ---
// When the player picks a region, set the team and go back to the menu.

// currentMascots: tracks which Pika-clone(s) are showing on the menu title
let currentMascots = [{ id: 25, name: "Pikachu" }];

// --- Update the Mascot ---
// Redraws the mascot image(s) using the current art style.
// Called when the region changes or when the art style toggle is flipped.
function updateMascot() {
    const container = document.getElementById("mascot-container");
    container.innerHTML = "";
    for (const mascot of currentMascots) {
        const img = document.createElement("img");
        img.src = getPokemonImageUrl(mascot.id, artStyle, false);
        img.alt = mascot.name;
        img.classList.add("title-mascot");
        container.appendChild(img);
    }
}

function selectRegion(regionId) {
    const region = REGIONS[regionId];
    currentRegionId = regionId;

    // Only load the region's default team if the player hasn't customized yet
    if (!teamCustomized) {
        currentTeam = { ...region.team };
    }

    currentMascots = region.mascots;
    updateMascot();

    // Go back to the main menu after picking a region
    showScreen("menu-screen");
}

// --- Team Display ---
// Updates the team screen to show the current Pokémon for each piece.

function updateTeamDisplay() {
    const pieces = ["king", "queen", "rook", "bishop", "knight", "pawn"];
    for (const piece of pieces) {
        const pokemon = currentTeam[piece];
        const sprite = document.getElementById("team-sprite-" + piece);
        const nameEl = document.getElementById("team-name-" + piece);
        sprite.src = getPokemonImageUrl(pokemon.id, artStyle, false);
        sprite.alt = pokemon.name;
        nameEl.textContent = pokemon.name;
    }
}

// --- Pokémon Picker ---
// Opens a picker overlay where you scroll through Pokémon sprites
// and search by name. Only shows Pokémon that pass the piece's rules.

let pickerPiece = null; // which piece we're picking for ("king", "queen", etc.)

function openPicker(pieceType) {
    pickerPiece = pieceType;
    const label = pieceType.charAt(0).toUpperCase() + pieceType.slice(1);
    document.getElementById("picker-title").textContent = "Choose a " + label;
    document.getElementById("picker-rule").textContent = PIECE_RULE_DESCRIPTIONS[pieceType];
    document.getElementById("picker-search").value = "";

    populatePickerGrid("");
    document.getElementById("picker-overlay").classList.remove("hidden");
    document.getElementById("picker-search").focus();
}

function closePicker() {
    document.getElementById("picker-overlay").classList.add("hidden");
    pickerPiece = null;
}

// Fill the picker grid with Pokémon sprites that pass the piece rules
function populatePickerGrid(searchText) {
    const grid = document.getElementById("picker-grid");
    grid.innerHTML = "";

    const ruleCheck = PIECE_RULES[pickerPiece];
    const query = searchText.toLowerCase();

    for (const pokemon of ALL_POKEMON) {
        // Skip if it doesn't pass the piece rule
        if (!ruleCheck(pokemon)) continue;

        // Skip if it doesn't match the search
        if (query && !pokemon.name.toLowerCase().includes(query)) continue;

        const btn = document.createElement("button");
        btn.classList.add("picker-pokemon");
        btn.title = pokemon.name;

        const img = document.createElement("img");
        img.src = getPixelSpriteUrl(pokemon.id);
        img.alt = pokemon.name;
        img.loading = "lazy"; // browser only loads visible images
        btn.appendChild(img);

        btn.addEventListener("click", () => selectPokemonFromPicker(pokemon));
        grid.appendChild(btn);
    }
}

// Called when the player clicks a Pokémon in the picker
function selectPokemonFromPicker(pokemon) {
    // Update the current team with the new choice
    currentTeam[pickerPiece] = {
        id: pokemon.id,
        name: pokemon.name,
        dexNum: String(pokemon.id).padStart(3, "0"),
    };
    teamCustomized = true;

    // Close the picker and refresh the team display
    closePicker();
    updateTeamDisplay();
}

// --- Hook up the buttons ---

// Menu screen buttons
document.getElementById("menu-play-btn").addEventListener("click", () => showScreen("mode-screen"));
document.getElementById("menu-rules-btn").addEventListener("click", () => showScreen("rules-screen"));
document.getElementById("menu-team-btn").addEventListener("click", () => {
    updateTeamDisplay();
    showScreen("team-screen");
});
document.getElementById("menu-region-btn").addEventListener("click", () => showScreen("region-screen"));
document.getElementById("menu-settings-btn").addEventListener("click", () => showScreen("settings-screen"));

// Mode screen buttons
document.getElementById("mode-friend-btn").addEventListener("click", () => {
    gameMode = "friend";
    startGame();
});
document.getElementById("mode-computer-btn").addEventListener("click", () => showScreen("difficulty-screen"));
document.getElementById("mode-back-btn").addEventListener("click", () => showScreen("menu-screen"));

// Difficulty screen buttons
document.getElementById("diff-easy-btn").addEventListener("click", () => {
    gameMode = "computer";
    difficulty = "easy";
    startGame();
});
document.getElementById("diff-medium-btn").addEventListener("click", () => {
    gameMode = "computer";
    difficulty = "medium";
    startGame();
});
document.getElementById("diff-hard-btn").addEventListener("click", () => {
    gameMode = "computer";
    difficulty = "hard";
    startGame();
});
document.getElementById("diff-back-btn").addEventListener("click", () => showScreen("mode-screen"));

// Team screen buttons
document.getElementById("team-back-btn").addEventListener("click", () => showScreen("menu-screen"));
document.getElementById("team-default-btn").addEventListener("click", () => {
    // Reset to the current region's default team
    currentTeam = { ...REGIONS[currentRegionId].team };
    teamCustomized = false;
    updateTeamDisplay();
});

// Team piece card buttons: click one to open the Pokémon picker
document.querySelectorAll(".team-piece-card").forEach(btn => {
    btn.addEventListener("click", () => {
        const pieceType = btn.getAttribute("data-piece");
        openPicker(pieceType);
    });
});

// Picker close/cancel button
document.getElementById("picker-close-btn").addEventListener("click", closePicker);

// Promotion overlay buttons (Queen, Rook, Bishop, Knight)
document.querySelectorAll(".promotion-option").forEach(btn => {
    btn.addEventListener("click", () => {
        const piece = btn.dataset.piece; // "q", "r", "b", or "n"
        completePromotion(piece);
    });
});

// Picker search: filter the grid as the player types
document.getElementById("picker-search").addEventListener("input", (e) => {
    populatePickerGrid(e.target.value);
});

// Region screen buttons
document.getElementById("region-back-btn").addEventListener("click", () => showScreen("menu-screen"));

// Hook up all 9 region buttons
document.querySelectorAll(".region-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const regionId = btn.getAttribute("data-region");
        selectRegion(regionId);
    });
});

// Settings screen
document.getElementById("settings-back-btn").addEventListener("click", () => showScreen("menu-screen"));

// Art Style toggle: switches between "pixel" and "official" (HD)
document.getElementById("art-style-toggle").addEventListener("change", (e) => {
    if (e.target.checked) {
        artStyle = "official";
        document.getElementById("toggle-pixel").classList.remove("active");
        document.getElementById("toggle-hd").classList.add("active");
    } else {
        artStyle = "pixel";
        document.getElementById("toggle-pixel").classList.add("active");
        document.getElementById("toggle-hd").classList.remove("active");
    }
    // Update the mascot on the menu to match the new art style
    updateMascot();
});

// Sound toggle: switches sound on/off
document.getElementById("sound-toggle").addEventListener("change", (e) => {
    soundEnabled = e.target.checked;
    if (e.target.checked) {
        document.getElementById("toggle-sound-off").classList.remove("active");
        document.getElementById("toggle-sound-on").classList.add("active");
    } else {
        document.getElementById("toggle-sound-off").classList.add("active");
        document.getElementById("toggle-sound-on").classList.remove("active");
    }
});

// Rules screen buttons
document.getElementById("rules-back-btn").addEventListener("click", () => showScreen("menu-screen"));

// Menu Continue button (loads saved game)
document.getElementById("menu-continue-btn").addEventListener("click", loadGame);

// Game screen buttons
document.getElementById("new-game-btn").addEventListener("click", goToMenu);
document.getElementById("save-quit-btn").addEventListener("click", saveAndQuit);
document.getElementById("game-over-new-game").addEventListener("click", startGame);
document.getElementById("game-over-review").addEventListener("click", startReview);
document.getElementById("review-start").addEventListener("click", reviewGoToStart);
document.getElementById("review-back").addEventListener("click", reviewBack);
document.getElementById("review-forward").addEventListener("click", reviewForward);
document.getElementById("review-end").addEventListener("click", reviewGoToEnd);
document.getElementById("review-exit").addEventListener("click", exitReview);

// --- Fun Facts ---
// A random fact shows at the bottom of the main menu each time you visit.

const FUN_FACTS = [
    "Did you know? Pikachu is #25 in the National Pokédex!",
    "Snorlax weighs 1,014 lbs, making it one of the heaviest non-legendary Pokémon!",
    "The word 'checkmate' comes from the Persian phrase 'shah mat,' meaning 'the king is helpless.'",
    "Mewtwo was created by scientists using Mew's DNA!",
    "A knight is the only chess piece that can jump over other pieces.",
    "Jolteon has a base Speed of 130, way higher than its base HP of 65!",
    "The longest possible chess game is 5,949 moves!",
    "Alakazam has an IQ of over 5,000 and a massive Special Attack stat.",
    "In chess, a pawn that reaches the other side of the board can become a queen!",
    "Charizard is NOT a Dragon type. It's Fire/Flying!",
    "The queen is the most powerful piece in chess, able to move in any direction.",
    "There are more possible chess games than atoms in the observable universe!",
    "Shiny Pokémon were first introduced in Generation II (Gold and Silver).",
    "A stalemate means no one wins. It's a draw!",
    "Eevee can evolve into 8 different Pokémon, more than any other Pokémon!",
    "The fastest checkmate possible takes only 2 moves. It's called Fool's Mate!",
    "Magikarp is considered the weakest Pokémon, but it evolves into the mighty Gyarados!",
    "In chess, the king can never move into check.",
    "Wailord is 47 feet long but only weighs 877 lbs. It's lighter than it looks!",
    "The rook is named after a chariot from ancient Persian chess.",
];

function showRandomFunFact() {
    const factElement = document.getElementById("fun-fact");
    const randomIndex = Math.floor(Math.random() * FUN_FACTS.length);
    factElement.textContent = FUN_FACTS[randomIndex];
}

// Show a fun fact right away
showRandomFunFact();

// Check for a saved game on startup
updateContinueButton();

// Load stats on startup
updateStatsDisplay();

// --- Start on the Main Menu ---
// (Don't render the board yet; that happens when the player clicks "vs Friend")
