// A small, hand-checked knowledge base used by the offline provider (no API key needed).
// It lets the full product loop work in development, demos and tests.
import type { AppItem } from "../../shared/app";

export interface Topic {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
  style: "space" | "land" | "ocean" | "night" | "sky" | "cave";
  sky: string;
  ground: string;
  decorations: string[];
  player: { emoji: string; name: string };
  collectibles: { emoji: string; name: string; fact: string }[];
  hazards: { emoji: string; name: string; moves: boolean }[];
  facts: { keys: string[]; text: string }[];
  items: AppItem[];
  quiz: { question: string; options: string[]; answer: number; explanation: string }[];
  detective: { statements: string[]; wrong: number; correction: string };
}

const item = (emoji: string, title: string, subtitle: string, description: string, facts: string[]): AppItem => ({
  emoji,
  title,
  subtitle,
  description,
  facts,
});

export const TOPICS: Topic[] = [
  {
    id: "mars",
    label: "Mars",
    emoji: "🔴",
    keywords: ["mars", "martian", "olympus", "rover", "red planet", "perseverance", "curiosity", "phobos"],
    style: "land",
    sky: "#e8a36b",
    ground: "#b5532e",
    decorations: ["🪨", "⛰️", "🛰️"],
    player: { emoji: "🚙", name: "Rover" },
    collectibles: [
      { emoji: "💎", name: "Crystal", fact: "Mars looks red because its dust contains iron oxide — rust!" },
      { emoji: "🧊", name: "Ice", fact: "Mars has frozen water in its polar ice caps." },
      { emoji: "🪨", name: "Rock sample", fact: "Rovers collect rock samples to learn about Mars's past." },
      { emoji: "🌋", name: "Olympus Mons", fact: "Olympus Mons is the biggest volcano in the solar system — about 2.5 times taller than Mount Everest." },
    ],
    hazards: [
      { emoji: "🌪️", name: "Dust storm", moves: true },
      { emoji: "☄️", name: "Meteor", moves: false },
    ],
    facts: [
      { keys: ["red", "color", "colour", "rust"], text: "Mars looks red because its rocks and dust contain lots of iron oxide — the same stuff as rust. The dust blows around and even tints the sky orange-pink." },
      { keys: ["volcano", "olympus", "big", "mountain", "tall"], text: "Olympus Mons on Mars is the biggest volcano in the solar system — about 22 km tall, roughly 2.5 times the height of Mount Everest. Mars volcanoes grew so big because Mars has no moving plates, so lava kept piling up in the same spot for millions of years, and Mars's weaker gravity lets mountains stand taller." },
      { keys: ["moon", "moons", "phobos", "deimos"], text: "Mars has two small, potato-shaped moons called Phobos and Deimos." },
      { keys: ["day", "sol", "long"], text: "A day on Mars is called a sol and lasts about 24 hours and 40 minutes — very close to an Earth day!" },
      { keys: ["year", "orbit"], text: "A year on Mars lasts 687 Earth days, because Mars is farther from the Sun and takes longer to go around it." },
      { keys: ["gravity", "jump", "weigh"], text: "Gravity on Mars is only about 38% of Earth's, so you could jump almost three times higher there." },
      { keys: ["rover", "robot", "perseverance", "curiosity", "helicopter"], text: "Robot rovers like Curiosity and Perseverance explore Mars. Perseverance even brought a little helicopter called Ingenuity, the first aircraft to fly on another planet." },
      { keys: ["cold", "temperature", "hot", "weather"], text: "Mars is very cold — about −60 °C on average — because its air is thin and it is farther from the Sun than Earth." },
      { keys: ["water", "ice", "life"], text: "Mars has ice at its poles and under the ground. Scientists are searching for signs that tiny life might have existed there long ago, when Mars was wetter." },
      { keys: ["canyon", "valles"], text: "Valles Marineris is a giant canyon on Mars about 4,000 km long — it would stretch across the whole United States." },
    ],
    items: [
      item("🌋", "Olympus Mons", "The biggest volcano in the solar system", "A giant shield volcano about 22 km tall.", ["About 2.5× taller than Mount Everest", "It's as wide as the country of Poland"]),
      item("🏜️", "Valles Marineris", "A gigantic canyon", "A canyon system about 4,000 km long.", ["Ten times longer than the Grand Canyon"]),
      item("🧊", "Polar ice caps", "Frozen water and dry ice", "White caps at the north and south poles.", ["They grow and shrink with the seasons"]),
      item("🌑", "Phobos", "Mars's bigger moon", "A small, lumpy moon that zooms around Mars three times a day.", ["It is slowly getting closer to Mars"]),
      item("🌒", "Deimos", "Mars's smaller moon", "A tiny moon only about 12 km across.", ["Its name means 'dread' in Greek"]),
      item("🚙", "Perseverance", "A NASA rover", "A car-sized robot looking for signs of ancient life.", ["Landed in 2021", "Carried the Ingenuity helicopter"]),
    ],
    quiz: [
      { question: "Why is Mars red?", options: ["Rusty dust", "It's hot", "Red plants", "Paint"], answer: 0, explanation: "Mars dust has iron oxide — rust!" },
      { question: "How many moons does Mars have?", options: ["None", "One", "Two", "Ten"], answer: 2, explanation: "Phobos and Deimos." },
      { question: "What is Olympus Mons?", options: ["A rover", "A volcano", "A moon", "A storm"], answer: 1, explanation: "The biggest volcano in the solar system." },
      { question: "Compared to Earth, gravity on Mars is…", options: ["Stronger", "The same", "Weaker"], answer: 2, explanation: "About 38% of Earth's." },
    ],
    detective: {
      statements: [
        "Mars looks red because its dust contains iron oxide, like rust.",
        "Mars has three moons: Phobos, Deimos and Luna.",
        "Olympus Mons on Mars is the biggest volcano in the solar system.",
      ],
      wrong: 1,
      correction: "Mars has only two moons, Phobos and Deimos. “Luna” is a name for Earth's Moon!",
    },
  },
  {
    id: "space",
    label: "Space",
    emoji: "🪐",
    keywords: ["space", "planet", "planets", "solar system", "sun", "moon", "star", "stars", "jupiter", "saturn", "venus", "galaxy", "astronaut", "rocket", "universe"],
    style: "space",
    sky: "#0b1033",
    ground: "#2a2f5c",
    decorations: ["✨", "🌟", "🪐"],
    player: { emoji: "🚀", name: "Rocket" },
    collectibles: [
      { emoji: "⭐", name: "Star", fact: "The Sun is a star — the closest one to us." },
      { emoji: "🪐", name: "Saturn", fact: "Saturn's rings are made mostly of chunks of ice." },
      { emoji: "🌕", name: "Moon", fact: "The Moon is slowly drifting away from Earth, about 4 cm every year." },
      { emoji: "☀️", name: "Sun", fact: "Sunlight takes about 8 minutes to travel to Earth." },
    ],
    hazards: [
      { emoji: "☄️", name: "Meteor", moves: true },
      { emoji: "🕳️", name: "Black hole", moves: false },
    ],
    facts: [
      { keys: ["planet", "planets", "how many", "solar system"], text: "Our solar system has 8 planets: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus and Neptune." },
      { keys: ["jupiter", "biggest", "largest"], text: "Jupiter is the biggest planet — more than 1,300 Earths could fit inside it!" },
      { keys: ["saturn", "rings", "ring"], text: "Saturn's beautiful rings are made mostly of chunks of ice, from tiny grains to pieces as big as a house." },
      { keys: ["venus", "hottest", "hot"], text: "Venus is the hottest planet (about 465 °C) even though Mercury is closer to the Sun. Its thick carbon-dioxide air traps heat like a blanket." },
      { keys: ["sun", "star"], text: "The Sun is a star. It holds about 99.8% of all the mass in our solar system, and its light takes about 8 minutes to reach us." },
      { keys: ["moon"], text: "The Moon is about 384,000 km away. It is slowly moving away from Earth — about 4 cm every year." },
      { keys: ["star", "stars", "twinkle"], text: "Stars twinkle because their light passes through moving layers of Earth's air, which bend it slightly." },
      { keys: ["galaxy", "milky way"], text: "We live in a galaxy called the Milky Way, which has more than 100 billion stars." },
    ],
    items: [
      item("☀️", "Sun", "Our star", "A giant ball of hot gas that lights our solar system.", ["Light takes about 8 minutes to reach Earth"]),
      item("🌑", "Mercury", "Closest to the Sun", "The smallest planet.", ["A year lasts 88 days"]),
      item("🟡", "Venus", "The hottest planet", "Covered in thick clouds.", ["About 465 °C at the surface"]),
      item("🌍", "Earth", "Our home", "The only planet we know has life.", ["About 71% is covered by oceans"]),
      item("🔴", "Mars", "The red planet", "A cold, dusty world with giant volcanoes.", ["Has two moons"]),
      item("🟠", "Jupiter", "The biggest planet", "A gas giant with a huge storm called the Great Red Spot.", ["Over 1,300 Earths could fit inside"]),
      item("🪐", "Saturn", "The ringed planet", "A gas giant with bright icy rings.", ["Its rings are mostly ice"]),
      item("🔵", "Neptune", "The windiest planet", "The farthest planet from the Sun.", ["Winds can reach over 2,000 km/h"]),
    ],
    quiz: [
      { question: "How many planets are in our solar system?", options: ["7", "8", "9", "12"], answer: 1, explanation: "Eight planets." },
      { question: "Which planet is the biggest?", options: ["Earth", "Saturn", "Jupiter", "Mars"], answer: 2, explanation: "Jupiter!" },
      { question: "What are Saturn's rings made of?", options: ["Ice", "Fire", "Gold", "Clouds"], answer: 0, explanation: "Mostly chunks of ice." },
      { question: "What is the Sun?", options: ["A planet", "A star", "A moon"], answer: 1, explanation: "The Sun is a star." },
    ],
    detective: {
      statements: [
        "Jupiter is the biggest planet in our solar system.",
        "The Sun is the biggest planet in our solar system.",
        "Saturn's rings are made mostly of ice.",
      ],
      wrong: 1,
      correction: "The Sun isn't a planet at all — it's a star!",
    },
  },
  {
    id: "volcanoes",
    label: "Volcanoes",
    emoji: "🌋",
    keywords: ["volcano", "volcanoes", "lava", "magma", "eruption", "erupt"],
    style: "land",
    sky: "#3b1f2b",
    ground: "#4a2a1a",
    decorations: ["🌋", "🔥", "🪨"],
    player: { emoji: "🧑‍🔬", name: "Scientist" },
    collectibles: [
      { emoji: "💎", name: "Crystal", fact: "Some crystals form when lava cools down slowly." },
      { emoji: "🪨", name: "Obsidian", fact: "Obsidian is volcanic glass made when lava cools very fast." },
      { emoji: "🌱", name: "Sprout", fact: "Volcanic ash makes soil very good for growing plants." },
    ],
    hazards: [
      { emoji: "🔥", name: "Lava blob", moves: true },
      { emoji: "💨", name: "Ash cloud", moves: true },
    ],
    facts: [
      { keys: ["what", "volcano", "how"], text: "A volcano is an opening in Earth's crust where hot melted rock, gas and ash escape. Underground the melted rock is called magma; once it comes out it's called lava." },
      { keys: ["hot", "temperature", "lava"], text: "Lava can be hotter than 1,000 °C — hot enough to melt many metals." },
      { keys: ["ring of fire", "where", "pacific"], text: "Most of Earth's active volcanoes sit around the Pacific Ocean in a zone called the Ring of Fire." },
      { keys: ["biggest", "largest", "mauna"], text: "Mauna Loa in Hawaii is the largest active volcano on Earth. But Olympus Mons on Mars is much bigger!" },
      { keys: ["ocean", "underwater", "sea"], text: "Many volcanoes are hidden under the ocean. Some grow tall enough to become islands — that's how Hawaii formed." },
      { keys: ["soil", "plants", "good"], text: "Volcanic ash breaks down into very rich soil, which is why farms often grow near old volcanoes." },
    ],
    items: [
      item("🌋", "Mauna Loa", "Hawaii, USA", "The largest active volcano on Earth.", ["A shield volcano with gentle slopes"]),
      item("🗻", "Mount Fuji", "Japan", "A famous, cone-shaped volcano.", ["Last erupted in 1707"]),
      item("🔥", "Kīlauea", "Hawaii, USA", "One of the most active volcanoes in the world.", ["Lava often flows into the sea"]),
      item("⛰️", "Mount Vesuvius", "Italy", "Buried the Roman city of Pompeii in 79 CE.", ["Still active today"]),
      item("🔴", "Olympus Mons", "Mars", "The biggest volcano in the solar system.", ["About 22 km tall"]),
    ],
    quiz: [
      { question: "What is lava called before it erupts?", options: ["Magma", "Ash", "Steam"], answer: 0, explanation: "Underground it's magma." },
      { question: "Where are most active volcanoes?", options: ["Ring of Fire", "Antarctica only", "The Moon"], answer: 0, explanation: "Around the Pacific Ocean." },
      { question: "Which is the biggest volcano in the solar system?", options: ["Mount Fuji", "Olympus Mons", "Vesuvius"], answer: 1, explanation: "It's on Mars." },
    ],
    detective: {
      statements: [
        "Magma is melted rock under the ground.",
        "Volcanoes only exist on Earth.",
        "Volcanic ash can make soil very good for plants.",
      ],
      wrong: 1,
      correction: "Other worlds have volcanoes too — Olympus Mons on Mars is the biggest one we know!",
    },
  },
  {
    id: "animals",
    label: "Animals",
    emoji: "🦁",
    keywords: ["animal", "animals", "africa", "african", "lion", "elephant", "giraffe", "zebra", "cheetah", "safari", "hippo", "gorilla", "zoo", "wildlife"],
    style: "land",
    sky: "#f5c16c",
    ground: "#c49a4a",
    decorations: ["🌳", "🌾", "🌴"],
    player: { emoji: "🦁", name: "Lion" },
    collectibles: [
      { emoji: "💧", name: "Water", fact: "Elephants can drink around 200 litres of water in a day." },
      { emoji: "🍃", name: "Leaves", fact: "Giraffes use their long tongues (about 50 cm!) to grab leaves." },
      { emoji: "🍉", name: "Melon", fact: "Many animals get water from juicy fruits when it's dry." },
    ],
    hazards: [
      { emoji: "🌵", name: "Cactus", moves: false },
      { emoji: "🐍", name: "Snake", moves: true },
    ],
    facts: [
      { keys: ["lion", "roar", "pride"], text: "Lions live in family groups called prides. A lion's roar can be heard up to 8 km away!" },
      { keys: ["elephant", "trunk", "biggest", "largest"], text: "The African elephant is the largest land animal. Its trunk has tens of thousands of muscles and can pick up something as small as a peanut." },
      { keys: ["giraffe", "tall", "neck"], text: "Giraffes are the tallest animals — up to about 5.5 m. Their necks have seven bones, the same number as ours!" },
      { keys: ["zebra", "stripes"], text: "Every zebra has its own stripe pattern, like a fingerprint." },
      { keys: ["cheetah", "fast", "fastest", "speed"], text: "The cheetah is the fastest land animal. It can sprint at about 100 km/h, but only for short bursts." },
      { keys: ["hippo", "swim"], text: "Hippos spend most of the day in water to stay cool — but they can't really swim! They walk or bounce along the bottom." },
      { keys: ["meerkat"], text: "Meerkats take turns standing guard and call out when they spot danger." },
    ],
    items: [
      item("🦁", "Lion", "The king of the savanna", "Lions live in groups called prides and hunt together.", ["Roar can be heard 8 km away", "Sleep up to 20 hours a day"]),
      item("🐘", "African Elephant", "The largest land animal", "Elephants are smart, social and have amazing memories.", ["Can drink around 200 litres of water a day", "Use their trunk like a hand"]),
      item("🦒", "Giraffe", "The tallest animal", "Giraffes eat leaves from tall acacia trees.", ["Up to 5.5 m tall", "Tongue is about 50 cm long"]),
      item("🦓", "Zebra", "Stripy grazer", "Zebras live in herds and eat grass.", ["Every stripe pattern is unique"]),
      item("🐆", "Cheetah", "The fastest land animal", "Built for speed with a light body and long legs.", ["Can reach about 100 km/h"]),
      item("🦛", "Hippopotamus", "River giant", "Hippos stay in water during the day and graze at night.", ["Can't really swim — they walk on the river bottom"]),
      item("🦏", "Rhinoceros", "Armored grazer", "Rhinos have thick skin and horns.", ["Horns are made of keratin, like your fingernails"]),
      item("🦍", "Gorilla", "The largest primate", "Gorillas live in family groups in forests.", ["Share about 98% of their DNA with humans"]),
    ],
    quiz: [
      { question: "What is a group of lions called?", options: ["A herd", "A pride", "A pack"], answer: 1, explanation: "A pride!" },
      { question: "Which is the fastest land animal?", options: ["Lion", "Cheetah", "Zebra", "Elephant"], answer: 1, explanation: "About 100 km/h." },
      { question: "What are rhino horns made of?", options: ["Bone", "Keratin", "Wood"], answer: 1, explanation: "The same stuff as fingernails." },
      { question: "Which is the tallest animal?", options: ["Giraffe", "Elephant", "Gorilla"], answer: 0, explanation: "Up to 5.5 m." },
    ],
    detective: {
      statements: [
        "A group of lions is called a pride.",
        "Cheetahs are the fastest land animals.",
        "All zebras have exactly the same stripes.",
      ],
      wrong: 2,
      correction: "Every zebra's stripes are unique — like a fingerprint!",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    emoji: "🌊",
    keywords: ["ocean", "sea", "shark", "whale", "fish", "octopus", "coral", "reef", "dolphin", "underwater", "turtle"],
    style: "ocean",
    sky: "#0e5c8a",
    ground: "#d9c48f",
    decorations: ["🪸", "🐚", "🌿"],
    player: { emoji: "🐢", name: "Turtle" },
    collectibles: [
      { emoji: "🐚", name: "Shell", fact: "Shells are homes made by animals like snails and clams." },
      { emoji: "🐟", name: "Fish", fact: "Some fish can change color to hide." },
      { emoji: "🦪", name: "Pearl", fact: "Pearls form inside oysters, layer by layer." },
    ],
    hazards: [
      { emoji: "🦈", name: "Shark", moves: true },
      { emoji: "🪼", name: "Jellyfish", moves: true },
    ],
    facts: [
      { keys: ["ocean", "how much", "cover"], text: "Oceans cover about 71% of Earth's surface." },
      { keys: ["whale", "biggest", "largest", "blue"], text: "The blue whale is the largest animal known to have ever lived — bigger than any dinosaur." },
      { keys: ["octopus", "heart", "blood"], text: "Octopuses have three hearts and blue blood!" },
      { keys: ["deep", "deepest", "trench"], text: "The deepest known point in the ocean is the Challenger Deep in the Mariana Trench — about 11 km down." },
      { keys: ["coral", "reef"], text: "Coral reefs are built by tiny animals called coral polyps. Reefs are home to about a quarter of all ocean species." },
      { keys: ["shark"], text: "Sharks have been around for more than 400 million years. Many sharks grow new teeth all their lives." },
    ],
    items: [
      item("🐋", "Blue Whale", "The largest animal ever", "Eats tiny krill — tons of them each day.", ["Its heart is as big as a small car"]),
      item("🐙", "Octopus", "Clever shape-shifter", "Can squeeze through tiny gaps and change color.", ["Three hearts", "Blue blood"]),
      item("🦈", "Great White Shark", "Top ocean hunter", "A powerful predator with a great sense of smell.", ["Keeps growing new teeth"]),
      item("🐢", "Sea Turtle", "Ocean traveler", "Swims thousands of kilometres.", ["Returns to the beach where it hatched to lay eggs"]),
      item("🐬", "Dolphin", "Playful and smart", "Dolphins use clicks and whistles to talk.", ["Sleep with half their brain at a time"]),
      item("🪸", "Coral", "Reef builder", "Tiny animals that build giant reefs.", ["Reefs shelter about 25% of ocean species"]),
    ],
    quiz: [
      { question: "How many hearts does an octopus have?", options: ["1", "2", "3"], answer: 2, explanation: "Three!" },
      { question: "What is the largest animal ever?", options: ["T. rex", "Blue whale", "Elephant"], answer: 1, explanation: "The blue whale." },
      { question: "How much of Earth do oceans cover?", options: ["About 30%", "About 50%", "About 71%"], answer: 2, explanation: "About 71%." },
    ],
    detective: {
      statements: [
        "Octopuses have three hearts.",
        "The blue whale is the largest animal known to have lived.",
        "Oceans cover only about 10% of Earth.",
      ],
      wrong: 2,
      correction: "Oceans cover about 71% of Earth's surface — most of our planet!",
    },
  },
  {
    id: "dinosaurs",
    label: "Dinosaurs",
    emoji: "🦖",
    keywords: ["dinosaur", "dinosaurs", "dino", "t-rex", "trex", "rex", "triceratops", "fossil", "jurassic", "stegosaurus"],
    style: "land",
    sky: "#9fd4a3",
    ground: "#6b8e3a",
    decorations: ["🌴", "🌿", "🌋"],
    player: { emoji: "🦕", name: "Dino" },
    collectibles: [
      { emoji: "🥚", name: "Dino egg", fact: "Dinosaurs hatched from eggs, like birds." },
      { emoji: "🦴", name: "Fossil", fact: "Fossils are the remains of ancient living things, turned to rock." },
      { emoji: "🌿", name: "Fern", fact: "Plant-eating dinosaurs munched on ferns and conifers." },
    ],
    hazards: [
      { emoji: "☄️", name: "Asteroid", moves: true },
      { emoji: "🦖", name: "T. rex", moves: true },
    ],
    facts: [
      { keys: ["how long", "lived", "when"], text: "Dinosaurs lived on Earth for about 165 million years." },
      { keys: ["bird", "birds", "alive", "still"], text: "Birds are living dinosaurs! They evolved from small feathered dinosaurs." },
      { keys: ["extinct", "die", "died", "asteroid"], text: "About 66 million years ago a huge asteroid hit Earth near Mexico. It changed the climate, and most dinosaurs died out." },
      { keys: ["feather", "feathers"], text: "Many dinosaurs had feathers — some were fluffy, some were colorful." },
      { keys: ["biggest", "largest", "argentinosaurus"], text: "Some of the biggest dinosaurs, like Argentinosaurus, may have been over 30 m long." },
      { keys: ["name", "mean", "word"], text: "The word dinosaur means “terrible lizard” — though dinosaurs weren't actually lizards." },
      { keys: ["t-rex", "trex", "rex", "bite"], text: "Tyrannosaurus rex had one of the strongest bites of any land animal ever." },
    ],
    items: [
      item("🦖", "Tyrannosaurus rex", "Mighty meat-eater", "A huge predator with a massive bite.", ["Lived about 68–66 million years ago"]),
      item("🦕", "Brachiosaurus", "Long-necked giant", "A plant-eater that could reach tall treetops.", ["Front legs longer than back legs"]),
      item("🔺", "Triceratops", "Three-horned face", "A plant-eater with a big bony frill.", ["Its name means 'three-horned face'"]),
      item("🛡️", "Stegosaurus", "Plated back", "Had big plates on its back and spikes on its tail.", ["Brain was about the size of a lime"]),
      item("🪶", "Velociraptor", "Feathered and fast", "A turkey-sized hunter covered in feathers.", ["Much smaller than in the movies"]),
    ],
    quiz: [
      { question: "Which animals are living dinosaurs?", options: ["Lizards", "Birds", "Frogs"], answer: 1, explanation: "Birds!" },
      { question: "What does 'dinosaur' mean?", options: ["Terrible lizard", "Big bird", "Old bone"], answer: 0, explanation: "Terrible lizard." },
      { question: "What hit Earth 66 million years ago?", options: ["A comet of ice cream", "An asteroid", "The Moon"], answer: 1, explanation: "A huge asteroid." },
    ],
    detective: {
      statements: [
        "Birds evolved from dinosaurs.",
        "Humans and T. rex lived at the same time.",
        "Many dinosaurs had feathers.",
      ],
      wrong: 1,
      correction: "T. rex died out about 66 million years ago — humans appeared only a few hundred thousand years ago.",
    },
  },
  {
    id: "robots",
    label: "Robots & AI",
    emoji: "🤖",
    keywords: ["robot", "robots", "ai", "artificial intelligence", "machine", "computer", "coding", "code", "program"],
    style: "night",
    sky: "#1a2340",
    ground: "#3b4a6b",
    decorations: ["⚙️", "💡", "🔩"],
    player: { emoji: "🤖", name: "Robot" },
    collectibles: [
      { emoji: "🔋", name: "Battery", fact: "Robots need energy — often from batteries." },
      { emoji: "⚙️", name: "Gear", fact: "Gears let motors turn slowly but strongly, or fast but gently." },
      { emoji: "💾", name: "Data chip", fact: "AI learns patterns from lots of examples (data)." },
    ],
    hazards: [
      { emoji: "⚡", name: "Short circuit", moves: true },
      { emoji: "🐛", name: "Bug", moves: true },
    ],
    facts: [
      { keys: ["robot", "what", "work"], text: "A robot is a machine that can sense the world, decide what to do (with a computer) and act — like moving or grabbing." },
      { keys: ["sensor", "sensors", "see"], text: "Robots use sensors — cameras, touch sensors, distance sensors — to know what's around them." },
      { keys: ["word", "name", "robota"], text: "The word “robot” comes from a 1920 Czech play; “robota” means forced work." },
      { keys: ["ai", "artificial", "learn", "think"], text: "AI (artificial intelligence) is software that learns patterns from lots of examples. It can be very useful, but it can also be confidently wrong — so it's smart to double-check important facts." },
      { keys: ["mistake", "wrong", "hallucinat"], text: "AI sometimes makes things up that sound true. People call that a hallucination. That's why good creators verify what AI says." },
      { keys: ["code", "coding", "program"], text: "Code is a list of exact instructions for a computer. Computers follow them perfectly — even the mistakes, which we call bugs!" },
    ],
    items: [
      item("🚙", "Mars rover", "Explorer robot", "Drives on Mars and studies rocks.", ["Controlled from Earth with a delay of several minutes"]),
      item("🦾", "Robot arm", "Factory helper", "Builds cars and packs boxes.", ["Can repeat the same move thousands of times"]),
      item("🧹", "Robot vacuum", "Home helper", "Uses sensors to avoid furniture.", ["Maps rooms as it cleans"]),
      item("🚁", "Drone", "Flying robot", "Flies using spinning propellers.", ["Ingenuity flew on Mars!"]),
    ],
    quiz: [
      { question: "What do robots use to sense the world?", options: ["Sensors", "Magic", "Glue"], answer: 0, explanation: "Cameras, touch, distance sensors." },
      { question: "Can AI make mistakes?", options: ["Never", "Yes, sometimes"], answer: 1, explanation: "Always double-check important facts." },
      { question: "What is a bug in code?", options: ["An insect", "A mistake", "A robot"], answer: 1, explanation: "A mistake in the instructions." },
    ],
    detective: {
      statements: [
        "Robots use sensors to know what's around them.",
        "AI is always right, so you never need to check it.",
        "A bug is a mistake in code.",
      ],
      wrong: 1,
      correction: "AI can be confidently wrong! Checking important facts is what smart creators do.",
    },
  },
];

export function findTopic(text: string): Topic | null {
  const t = ` ${text.toLowerCase()} `;
  let best: { topic: Topic; score: number } | null = null;
  for (const topic of TOPICS) {
    const score = topic.keywords.reduce(
      (s, k) => s + (new RegExp(`[^a-z]${k.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}s?[^a-z]`).test(t) ? k.length : 0),
      0,
    );
    if (score && (!best || score > best.score)) best = { topic, score };
  }
  return best?.topic ?? null;
}

export const EMOJI: Record<string, string> = {
  rock: "🪨", rocks: "🪨", boulder: "🪨", alien: "👽", aliens: "👽", ufo: "🛸", rover: "🚙", star: "⭐", stars: "⭐",
  meteor: "☄️", meteors: "☄️", asteroid: "☄️", comet: "☄️", lava: "🔥", fire: "🔥", crystal: "💎", crystals: "💎",
  gem: "💎", gems: "💎", diamond: "💎", astronaut: "👩‍🚀", rocket: "🚀", robot: "🤖", lion: "🦁", elephant: "🐘",
  giraffe: "🦒", zebra: "🦓", fish: "🐟", shark: "🦈", sharks: "🦈", dinosaur: "🦖", dino: "🦕", volcano: "🌋",
  tree: "🌳", trees: "🌳", apple: "🍎", apples: "🍎", coin: "🪙", coins: "🪙", heart: "❤️", hearts: "❤️", ghost: "👻",
  ghosts: "👻", dragon: "🐉", cat: "🐱", cats: "🐱", dog: "🐶", dogs: "🐶", ball: "⚽", planet: "🪐", planets: "🪐",
  moon: "🌙", sun: "☀️", ice: "🧊", water: "💧", flower: "🌸", flowers: "🌸", bee: "🐝", bees: "🐝", spider: "🕷️",
  snake: "🐍", snakes: "🐍", bug: "🐛", bugs: "🐛", cloud: "☁️", clouds: "☁️", lightning: "⚡", rainbow: "🌈",
  cake: "🍰", candy: "🍬", pizza: "🍕", car: "🚗", satellite: "🛰️", key: "🔑", keys: "🔑", treasure: "💰",
  mushroom: "🍄", penguin: "🐧", whale: "🐋", octopus: "🐙", turtle: "🐢", butterfly: "🦋", unicorn: "🦄",
  crown: "👑", book: "📚", books: "📚", castle: "🏰", monster: "👾", monsters: "👾", zombie: "🧟", wizard: "🧙",
  bat: "🦇", bats: "🦇", storm: "🌪️", tornado: "🌪️", jellyfish: "🪼", cactus: "🌵", mountain: "⛰️", house: "🏠",
  city: "🏙️", horse: "🐴", unicorns: "🦄", banana: "🍌", carrot: "🥕", bone: "🦴", bones: "🦴", egg: "🥚",
  eggs: "🥚", shell: "🐚", shells: "🐚", pearl: "🦪", battery: "🔋", gear: "⚙️", snow: "❄️", snowflake: "❄️",
  penguins: "🐧", frog: "🐸", owl: "🦉", fox: "🦊", bear: "🐻", panda: "🐼", monkey: "🐒", bird: "🐦", birds: "🐦",
  me: "🧒", kid: "🧒", helicopter: "🚁", train: "🚂", boat: "⛵", ship: "🚢", moonbase: "🏠", dome: "🏠",
  cheetah: "🐆", hippo: "🦛", rhino: "🦏", gorilla: "🦍", tiger: "🐅", wolf: "🐺", flag: "🚩", ice_cream: "🍦",
};

export const DANGER_WORDS = new Set([
  "rock", "rocks", "boulder", "alien", "aliens", "meteor", "meteors", "asteroid", "comet", "lava", "fire", "ghost",
  "ghosts", "dragon", "spider", "snake", "snakes", "bug", "bugs", "lightning", "shark", "sharks", "monster",
  "monsters", "zombie", "bat", "bats", "storm", "tornado", "jellyfish", "cactus", "enemy", "enemies", "obstacle",
  "obstacles", "ufo", "wolf",
]);

export function emojiFor(word: string, fallback = "✨"): string {
  const w = word.toLowerCase().replace(/[^a-z_]/g, "");
  return EMOJI[w] ?? EMOJI[w.replace(/s$/, "")] ?? fallback;
}

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
