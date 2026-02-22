// ===== POKÉMON DATA =====
// This file knows which Pokémon goes on which chess piece
// and how to find their images on the internet.

// Each Pokémon has an ID number (its National Pokédex number).
// We use that number to load the right image from PokeAPI.

// --- Default Kanto Team ---
// These Pokémon follow all our piece rules:
//   King = any Pokémon (your favorite)
//   Queen = Legendary, Mythical, Ultra Beast, or Paradox
//   Rook = non-legendary, non-Ultra Beast, over 300 lbs
//   Bishop = Special Attack > physical Attack
//   Knight = Speed > HP
//   Pawn = regular Pokémon (not legendary, mythical, UB, pseudo, or paradox)

const KANTO_TEAM = {
    king:   { id: 6,   name: "Charizard",  dexNum: "006" },
    queen:  { id: 150, name: "Mewtwo",     dexNum: "150" },
    rook:   { id: 143, name: "Snorlax",    dexNum: "143" },
    bishop: { id: 65,  name: "Alakazam",   dexNum: "065" },
    knight: { id: 135, name: "Jolteon",    dexNum: "135" },
    pawn:   { id: 25,  name: "Pikachu",    dexNum: "025" },
};

// --- Johto Team ---
const JOHTO_TEAM = {
    king:   { id: 157, name: "Typhlosion",  dexNum: "157" },
    queen:  { id: 249, name: "Lugia",       dexNum: "249" },
    rook:   { id: 208, name: "Steelix",     dexNum: "208" },
    bishop: { id: 196, name: "Espeon",      dexNum: "196" },
    knight: { id: 169, name: "Crobat",      dexNum: "169" },
    pawn:   { id: 175, name: "Togepi",      dexNum: "175" },
};

// --- Hoenn Team ---
const HOENN_TEAM = {
    king:   { id: 257, name: "Blaziken",    dexNum: "257" },
    queen:  { id: 384, name: "Rayquaza",    dexNum: "384" },
    rook:   { id: 321, name: "Wailord",     dexNum: "321" },
    bishop: { id: 282, name: "Gardevoir",   dexNum: "282" },
    knight: { id: 254, name: "Sceptile",    dexNum: "254" },
    pawn:   { id: 280, name: "Ralts",       dexNum: "280" },
};

// --- Sinnoh Team ---
const SINNOH_TEAM = {
    king:   { id: 448, name: "Lucario",     dexNum: "448" },
    queen:  { id: 483, name: "Dialga",      dexNum: "483" },
    rook:   { id: 473, name: "Mamoswine",   dexNum: "473" },
    bishop: { id: 468, name: "Togekiss",    dexNum: "468" },
    knight: { id: 398, name: "Staraptor",   dexNum: "398" },
    pawn:   { id: 387, name: "Turtwig",     dexNum: "387" },
};

// --- Unova Team ---
const UNOVA_TEAM = {
    king:   { id: 571, name: "Zoroark",     dexNum: "571" },
    queen:  { id: 643, name: "Reshiram",    dexNum: "643" },
    rook:   { id: 623, name: "Golurk",      dexNum: "623" },
    bishop: { id: 609, name: "Chandelure",  dexNum: "609" },
    knight: { id: 620, name: "Mienshao",    dexNum: "620" },
    pawn:   { id: 501, name: "Oshawott",    dexNum: "501" },
};

// --- Kalos Team ---
const KALOS_TEAM = {
    king:   { id: 658, name: "Greninja",    dexNum: "658" },
    queen:  { id: 716, name: "Xerneas",     dexNum: "716" },
    rook:   { id: 713, name: "Avalugg",     dexNum: "713" },
    bishop: { id: 655, name: "Delphox",     dexNum: "655" },
    knight: { id: 663, name: "Talonflame",  dexNum: "663" },
    pawn:   { id: 656, name: "Froakie",     dexNum: "656" },
};

// --- Alola Team ---
const ALOLA_TEAM = {
    king:   { id: 724, name: "Decidueye",   dexNum: "724" },
    queen:  { id: 791, name: "Solgaleo",    dexNum: "791" },
    rook:   { id: 750, name: "Mudsdale",    dexNum: "750" },
    bishop: { id: 730, name: "Primarina",   dexNum: "730" },
    knight: { id: 743, name: "Ribombee",    dexNum: "743" },
    pawn:   { id: 722, name: "Rowlet",      dexNum: "722" },
};

// --- Galar Team ---
const GALAR_TEAM = {
    king:   { id: 815, name: "Cinderace",   dexNum: "815" },
    queen:  { id: 888, name: "Zacian",      dexNum: "888" },
    rook:   { id: 879, name: "Copperajah",  dexNum: "879" },
    bishop: { id: 858, name: "Hatterene",   dexNum: "858" },
    knight: { id: 887, name: "Dragapult",   dexNum: "887" },
    pawn:   { id: 816, name: "Sobble",      dexNum: "816" },
};

// --- Paldea Team ---
const PALDEA_TEAM = {
    king:   { id: 937, name: "Ceruledge",   dexNum: "937" },
    queen:  { id: 1008, name: "Miraidon",   dexNum: "1008" },
    rook:   { id: 977, name: "Dondozo",     dexNum: "977" },
    bishop: { id: 936, name: "Armarouge",   dexNum: "936" },
    knight: { id: 940, name: "Kilowattrel", dexNum: "940" },
    pawn:   { id: 906, name: "Sprigatito",  dexNum: "906" },
};

// --- All Regions ---
// This collects all 9 regions in one place.
// Picking a region just sets the default team. It does NOT restrict
// team customization. In Phase 8, you can swap in any Pokémon from
// any region (as long as they follow the piece rules).

const REGIONS = {
    kanto:  { name: "Kanto",  team: KANTO_TEAM,  mascots: [{ id: 25,  name: "Pikachu" }] },
    johto:  { name: "Johto",  team: JOHTO_TEAM,  mascots: [{ id: 172, name: "Pichu" }] },
    hoenn:  { name: "Hoenn",  team: HOENN_TEAM,   mascots: [{ id: 311, name: "Plusle" }, { id: 312, name: "Minun" }] },
    sinnoh: { name: "Sinnoh", team: SINNOH_TEAM,  mascots: [{ id: 417, name: "Pachirisu" }] },
    unova:  { name: "Unova",  team: UNOVA_TEAM,   mascots: [{ id: 587, name: "Emolga" }] },
    kalos:  { name: "Kalos",  team: KALOS_TEAM,   mascots: [{ id: 702, name: "Dedenne" }] },
    alola:  { name: "Alola",  team: ALOLA_TEAM,   mascots: [{ id: 777, name: "Togedemaru" }] },
    galar:  { name: "Galar",  team: GALAR_TEAM,   mascots: [{ id: 877, name: "Morpeko" }] },
    paldea: { name: "Paldea", team: PALDEA_TEAM,  mascots: [{ id: 921, name: "Pawmi" }] },
};

// --- Image URL Builders ---
// PokeAPI gives us free Pokémon images. We just need the Pokémon's ID number.

// Pixel sprites (the retro Game Boy style)
function getPixelSpriteUrl(pokemonId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`;
}

// Shiny pixel sprites (for the Black/opponent side)
function getShinyPixelSpriteUrl(pokemonId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${pokemonId}.png`;
}

// Official HD artwork
function getOfficialArtUrl(pokemonId) {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;
}

// --- Get the image URL for a Pokémon ---
// artStyle can be "pixel" or "official"
// isShiny is true for the Black side, false for White side
function getPokemonImageUrl(pokemonId, artStyle, isShiny) {
    if (artStyle === "pixel") {
        if (isShiny) {
            return getShinyPixelSpriteUrl(pokemonId);
        } else {
            return getPixelSpriteUrl(pokemonId);
        }
    } else {
        // For official artwork, shiny versions aren't always available,
        // so we use the normal one (we can add a CSS filter later)
        return getOfficialArtUrl(pokemonId);
    }
}

// --- Chess Starting Position ---
// In chess, the back row (from left to right) is:
// Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook
// The second row is all Pawns.

// This gives us the piece type for each position in the back row
const BACK_ROW = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];

// --- Piece Rule Checkers ---
// Each function takes a Pokémon from the ALL_POKEMON array (with weight, stats, flags)
// and returns true if that Pokémon is allowed to be that chess piece.

// King: any Pokémon can be your King!
function canBeKing() {
    return true;
}

// Queen: must be Legendary, Mythical, Ultra Beast, or Paradox
function canBeQueen(pokemon) {
    return pokemon.flags.some(f =>
        f === "legendary" || f === "mythical" || f === "ultraBeast" || f === "paradox"
    );
}

// Rook: must weigh over 300 lbs AND not be Legendary or Ultra Beast
// Weight is in hectograms. 300 lbs = about 1361 hectograms.
function canBeRook(pokemon) {
    const isHeavyEnough = pokemon.weight >= 1361;
    const notLegendary = !pokemon.flags.includes("legendary");
    const notUB = !pokemon.flags.includes("ultraBeast");
    return isHeavyEnough && notLegendary && notUB;
}

// Bishop: Special Attack must be higher than physical Attack
function canBeBishop(pokemon) {
    return pokemon.spAttack > pokemon.attack;
}

// Knight: Speed must be higher than HP
function canBeKnight(pokemon) {
    return pokemon.speed > pokemon.hp;
}

// Pawn: must be a regular Pokémon (no special flags at all)
function canBePawn(pokemon) {
    return pokemon.flags.length === 0;
}

// Collect all the rule checkers into one lookup object
const PIECE_RULES = {
    king: canBeKing,
    queen: canBeQueen,
    rook: canBeRook,
    bishop: canBeBishop,
    knight: canBeKnight,
    pawn: canBePawn,
};

// Human-readable descriptions of each piece's rule (shown in the picker)
const PIECE_RULE_DESCRIPTIONS = {
    king:   "Any Pokémon! Pick your favorite.",
    queen:  "Must be Legendary, Mythical, Ultra Beast, or Paradox.",
    rook:   "Must weigh over 300 lbs (and not Legendary or Ultra Beast).",
    bishop: "Must have higher Special Attack than physical Attack.",
    knight: "Must have higher Speed than HP.",
    pawn:   "Any regular Pokémon (not Legendary, Mythical, UB, pseudo, or Paradox).",
};

// --- Export everything so other files can use it ---
export { KANTO_TEAM, REGIONS, getPokemonImageUrl, getPixelSpriteUrl, BACK_ROW, PIECE_RULES, PIECE_RULE_DESCRIPTIONS };
