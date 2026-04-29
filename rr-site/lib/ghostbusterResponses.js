const THREAT_LEVELS = ["low", "medium", "high"];
const ESCALATING_INTENTS = new Set(["another_one", "its_moving", "trap_it", "coming_at_us"]);
const DEESCALATING_INTENTS = new Set(["got_it"]);

let threatLevel = "low";
let recentResponses = [];

export const ghostbusterResponseConfig = {
  personalities: ["leader", "nervous", "tech"],

  // Add more trigger phrases here. Keep them lowercase for easy matching.
  triggers: {
    behind_us: [
      "it's behind us",
      "behind us",
      "there's something behind us",
      "something is behind us",
    ],
    hear_something: [
      "i hear something",
      "did you hear that",
      "what was that sound",
      "i heard something",
    ],
    another_one: [
      "there's another one",
      "another one",
      "there are more",
      "more ghosts",
    ],
    got_it: [
      "we got it",
      "got it",
      "we caught it",
      "it's trapped",
    ],
    its_moving: [
      "it's moving",
      "it moved",
      "it's running",
      "it's getting away",
    ],
    i_see_it: [
      "i see it",
      "there it is",
      "i found it",
      "visual",
    ],
    where_did_it_go: [
      "where did it go",
      "i lost it",
      "where is it",
      "it disappeared",
    ],
    trap_it: [
      "trap it",
      "throw the trap",
      "get the trap",
      "open the trap",
    ],
    coming_at_us: [
      "it's coming at us",
      "it's charging",
      "it's attacking",
      "it's coming closer",
    ],
  },

  // Add or edit personality responses here. Each intent has leader, nervous, and tech pools.
  responses: {
    behind_us: {
      leader: [
        "Hold position. Do not turn yet. Everyone take one slow step forward.",
        "Rear contact confirmed. Keep your shoulders square and wait for my count.",
        "Stay calm. If it is behind us, we control the hallway in front of us first.",
      ],
      nervous: [
        "NOPE. I am not turning around. Somebody else can have the haunted neck today.",
        "Behind us? Great. Perfect. I love when the scary thing has good manners and sneaks up.",
        "Do not look yet. Actually, maybe look. No, wait. I hate this plan.",
      ],
      tech: [
        "Rear anomaly confirmed. The strongest reading is directly behind our position.",
        "Backfield signal is climbing. Recommend controlled pivot in three seconds.",
        "Scanner shows movement at six o'clock. Keep the trap pointed low.",
      ],
    },
    hear_something: {
      leader: [
        "Quiet. Everyone freeze and listen. We move only when we know where it is.",
        "Good catch. Hold the room and point to the sound source.",
        "Sound contact. Stay together and keep the trap hand ready.",
      ],
      nervous: [
        "I heard it too, and I officially do not like the way it sounded.",
        "That was either a ghost or the house clearing its throat. Both are bad.",
        "Yep. Heard it. My knees just filed a complaint.",
      ],
      tech: [
        "Audio spike detected. Frequency pattern suggests nearby movement.",
        "Sound event logged. Triangulating from the loudest echo point.",
        "Acoustic reading is unstable. Repeat the noise check and keep talking.",
      ],
    },
    another_one: {
      leader: [
        "Multiple targets. Stay close. We handle one at a time.",
        "New contact. Nobody runs. We tighten formation and keep eyes up.",
        "Second target confirmed. Reset the trap and prepare for a quick capture.",
      ],
      nervous: [
        "Another one? Of course there is another one. Why would there be just one nightmare?",
        "I was emotionally prepared for exactly zero ghosts, so this is a lot.",
        "More ghosts? Fantastic. Somebody tell them we are closed.",
      ],
      tech: [
        "Additional entity detected. Count is no longer singular.",
        "Multiple readings on the scanner. Signal separation is messy but confirmed.",
        "New anomaly entered the field. Threat index has increased.",
      ],
    },
    got_it: {
      leader: [
        "Good capture. Keep the trap closed and step back from it.",
        "Target secured. Nice work. Hold position until the room settles.",
        "Capture confirmed. Everybody breathe. We are back in control.",
      ],
      nervous: [
        "We got it? Oh thank goodness. I was about to retire from pretend emergencies.",
        "Trap closed. Great. Nobody open that unless it signs paperwork.",
        "Yes. Beautiful. Wonderful. Please do not let it wiggle out.",
      ],
      tech: [
        "Containment confirmed. Residual readings are dropping.",
        "Trap seal looks stable. Entity signal is contained.",
        "Capture event logged. Threat level decreasing.",
      ],
    },
    its_moving: {
      leader: [
        "It is moving. Track it, do not chase it. Keep the team together.",
        "Movement confirmed. Cut it off at the next doorway.",
        "Stay with it. Slow steps. We do not give it room to slip past.",
      ],
      nervous: [
        "It moved? I was really hoping it was more of a sitting ghost.",
        "Why is it running? What does it know that we do not know?",
        "It is getting away, and somehow I am offended and terrified.",
      ],
      tech: [
        "Motion trail detected. Target velocity is increasing.",
        "Scanner shows lateral movement. Predicting path toward the open space.",
        "Entity is mobile. Recommend intercept angle, not direct pursuit.",
      ],
    },
    i_see_it: {
      leader: [
        "Visual confirmed. Keep eyes on it and call out where it goes.",
        "Good spot. Do not rush. Guide the trap toward it slowly.",
        "You have visual. Hold steady and keep the team behind you.",
      ],
      nervous: [
        "You see it? Great. I will be over here bravely not seeing it.",
        "There it is? Wonderful. I hate when the invisible problem becomes visible.",
        "Visual contact. My official recommendation is tiny brave steps and no screaming. Maybe some screaming.",
      ],
      tech: [
        "Visual confirmation received. Scanner lock is improving.",
        "Target location acquired. Keep line of sight for three more seconds.",
        "Optical contact confirmed. Capture probability is rising.",
      ],
    },
    where_did_it_go: {
      leader: [
        "Hold. If we lost it, we listen first. Check corners and doorways.",
        "Do not split up. Sweep the room from left to right.",
        "It disappeared. Stay calm and watch for anything moving by itself.",
      ],
      nervous: [
        "It disappeared? That is the worst feature a ghost can have.",
        "I lost it too, which is exactly how every bad hallway story starts.",
        "Where did it go? Please let the answer be vacation.",
      ],
      tech: [
        "Target signal dropped. Searching for residual trail.",
        "Visual lost. Scanner shows faint activity near the nearest corner.",
        "Entity signature faded. Recommend slow room scan and audio check.",
      ],
    },
    trap_it: {
      leader: [
        "Open the trap on my count. Three, two, one, now.",
        "Trap team, forward. Everyone else step back and give it room.",
        "Set the trap low. Keep it steady. We only get one clean shot.",
      ],
      nervous: [
        "Open the trap? Yes. Great. Love opening the tiny box full of consequences.",
        "Throw the trap, but gently. Actually fast. Gentle and fast. Figure that out.",
        "Trap time. I am emotionally behind a couch, but professionally ready.",
      ],
      tech: [
        "Trap aperture ready. Align it with the strongest reading.",
        "Containment field primed. Deploy when the signal peaks.",
        "Capture window is open. Place the trap within two steps of the target.",
      ],
    },
    coming_at_us: {
      leader: [
        "Brace. Nobody runs. Step aside and let it pass into the trap line.",
        "Incoming contact. Hold your ground and keep the trap open.",
        "It is charging. Shift left together and keep eyes forward.",
      ],
      nervous: [
        "It is coming at us? That is my least favorite direction.",
        "No thank you, ghost. Personal space is still a rule.",
        "It is getting closer and my courage is buffering.",
      ],
      tech: [
        "Approach vector confirmed. Distance is closing quickly.",
        "Entity acceleration detected. Prepare immediate containment.",
        "Threat reading is high. Recommend lateral move and trap deployment.",
      ],
    },
  },

  fallback: [
    "Say that again. My scanner spiked.",
    "I'm getting weird readings, but no clear target.",
    "Keep talking. Something here is reacting.",
    "I don't like the energy in this room.",
  ],

  flavorLines: [
    "I'm not getting paid enough for this.",
    "This is going in the report.",
    "We should've brought more people.",
    "Next time, we stay in the car.",
    "I really hate this job sometimes.",
  ],

  threatLines: {
    medium: [
      "Stay sharp.",
      "Keep the trap close.",
      "Nobody wanders off.",
    ],
    high: [
      "This is a high-threat reading. Move together now.",
      "Everybody stay tight. We are in the spooky zone.",
      "No solo hero moves. Trap team takes the lead.",
    ],
  },
};

function normalize(text) {
  return text.toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();
}

function matchIntent(userText) {
  const normalizedText = normalize(userText);

  for (const [intent, phrases] of Object.entries(ghostbusterResponseConfig.triggers)) {
    if (phrases.some((phrase) => normalizedText.includes(normalize(phrase)))) {
      return intent;
    }
  }

  return null;
}

function updateThreatLevel(intent) {
  const currentIndex = THREAT_LEVELS.indexOf(threatLevel);

  if (ESCALATING_INTENTS.has(intent)) {
    threatLevel = THREAT_LEVELS[Math.min(currentIndex + 1, THREAT_LEVELS.length - 1)];
  }

  if (DEESCALATING_INTENTS.has(intent)) {
    threatLevel = THREAT_LEVELS[Math.max(currentIndex - 1, 0)];
  }
}

function pickWithoutRecent(options) {
  const freshOptions = options.filter((option) => !recentResponses.includes(option));
  return pick(freshOptions.length ? freshOptions : options);
}

function rememberResponse(response) {
  recentResponses = [response, ...recentResponses].slice(0, 2);
}

export function getGhostbusterResponse(userText) {
  const intent = matchIntent(userText);
  updateThreatLevel(intent);

  const personality = pick(ghostbusterResponseConfig.personalities);
  const responsePool = intent
    ? ghostbusterResponseConfig.responses[intent][personality]
    : ghostbusterResponseConfig.fallback;

  const mainResponse = pickWithoutRecent(responsePool);
  rememberResponse(mainResponse);

  const extraLines = [];
  if (threatLevel !== "low" && Math.random() < 0.35) {
    extraLines.push(pick(ghostbusterResponseConfig.threatLines[threatLevel]));
  }

  if (Math.random() < 0.2) {
    extraLines.push(pick(ghostbusterResponseConfig.flavorLines));
  }

  return [mainResponse, ...extraLines].join(" ");
}
