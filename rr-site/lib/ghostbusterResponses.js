const THREAT_LEVELS = ["low", "medium", "high"];
const ESCALATING_INTENTS = new Set([
  "another_one",
  "its_moving",
  "it_got_away",
  "trap_it",
  "coming_at_us",
  "behind_us",
  "dark_room",
  "touching_things",
]);
const DEESCALATING_INTENTS = new Set(["got_it", "celebrate", "safe_now"]);

let threatLevel = "low";
let recentResponses = [];

export const ghostbusterResponseConfig = {
  personalities: ["leader", "nervous", "tech"],

  // Add more trigger phrases here. Keep them lowercase for easy matching.
  triggers: {
    behind_us: [
      "it's behind us", "its behind us", "behind us", "behind me", "behind you",
      "there's something behind us", "something is behind us", "it's right behind us",
      "i think it's behind us", "i think its behind us", "check behind us",
    ],
    hear_something: [
      "i hear something", "i can hear it", "did you hear that", "you hear that",
      "what was that sound", "what was that noise", "i heard something", "i heard it",
      "i still hear it", "i hear it again", "listen", "there's a noise", "there is a noise",
      "i hear a ghost", "something made a sound", "it made a sound", "it made a noise",
    ],
    another_one: [
      "there's another one", "theres another one", "another one", "there are more",
      "more ghosts", "i hear another", "i see another", "there's more", "theres more",
      "two ghosts", "three ghosts", "a bunch of ghosts", "more are coming", "there are too many",
    ],
    got_it: [
      "we got it", "got it", "we caught it", "it's trapped", "its trapped", "we trapped it",
      "caught it", "trap is closed", "we did it", "we got the ghost", "it's in the trap",
      "its in the trap", "capture complete", "we captured it", "we win",
    ],
    its_moving: [
      "it's moving", "its moving", "it moved", "it's running", "its running",
      "it's getting away", "its getting away", "it is moving", "it ran", "it went that way",
      "it's floating", "its floating", "it's flying", "its flying", "it's fast", "it is fast",
    ],
    it_got_away: [
      "it got away", "it escaped", "it ran away", "we lost it", "it left", "it went away",
      "it went upstairs", "it went downstairs", "it went outside", "it went in the room",
      "it disappeared again", "it vanished", "it slipped away", "it got out",
    ],
    i_see_it: [
      "i see it", "there it is", "i found it", "visual", "i can see it",
      "it's over there", "its over there", "there's the ghost", "theres the ghost",
      "i spotted it", "i see the ghost", "it's by the couch", "it's by the door",
      "it's in the hallway", "it's in the kitchen", "it's in the bedroom",
    ],
    where_did_it_go: [
      "where did it go", "i lost it", "where is it", "it disappeared", "where'd it go",
      "where did the ghost go", "i don't see it", "i cant see it", "i can't see it",
      "it is gone", "it's gone", "its gone", "where is the ghost", "where'd the ghost go",
    ],
    trap_it: [
      "trap it", "throw the trap", "get the trap", "open the trap", "use the trap",
      "turn on the trap", "start the trap", "capture it", "catch it", "how do we catch it",
      "how do we trap it", "what do we do", "get it", "suck it in", "close the trap",
    ],
    coming_at_us: [
      "it's coming at us", "its coming at us", "it's charging", "its charging",
      "it's attacking", "its attacking", "it's coming closer", "its coming closer",
      "it's coming this way", "its coming this way", "it's coming for us", "run",
      "it's getting closer", "it is getting closer", "it's right here", "it's too close",
    ],
    hiding: [
      "it's hiding", "its hiding", "it is hiding", "it hid", "under the bed",
      "in the closet", "behind the couch", "under the couch", "behind the chair",
      "in the cabinet", "behind the curtain", "under the blanket", "in the toy box",
    ],
    spooky_room: [
      "the room is spooky", "this room is scary", "it's cold", "its cold", "cold in here",
      "lights are flickering", "the light flickered", "the door moved", "the door opened",
      "the closet opened", "something fell", "toys moved", "the curtains moved", "the chair moved",
    ],
    slime: [
      "there's slime", "theres slime", "slime", "it's slimy", "its slimy",
      "green stuff", "goo", "ghost goo", "slime on the floor", "slime on me",
    ],
    scared: [
      "i'm scared", "im scared", "we're scared", "were scared", "i'm afraid", "im afraid",
      "this is scary", "i don't want to", "i dont want to", "help me", "help us",
      "i'm nervous", "im nervous", "they're scared", "the kids are scared",
    ],
    call_for_help: [
      "send backup", "we need backup", "come help", "help us ghostbusters", "send the team",
      "where are you", "are you coming", "can you help", "we need help", "get over here",
    ],
    scan_it: [
      "scan it", "use the scanner", "what does the scanner say", "readings", "any readings",
      "check the meter", "meter", "pke", "what is it", "what kind of ghost", "identify it",
    ],
    celebrate: [
      "hooray", "yay", "we won", "we did it", "good job", "high five",
      "we saved the house", "mission complete", "all done", "we beat it",
    ],
    safe_now: [
      "are we safe", "is it safe", "is it gone", "are they gone", "all clear",
      "is the room clear", "can we go in", "can we come out", "is it over",
    ],
  },

  // Add or edit personality responses here. Each intent has leader, nervous, and tech pools.
  responses: {
    behind_us: {
      leader: [
        "Hold position. Do not turn yet. Everyone take one slow step forward.",
        "Rear contact confirmed. Keep your shoulders square and wait for my count.",
        "Stay calm. If it is behind us, we control the hallway in front of us first.",
        "Nobody spins around. Point the trap backward and take two tiny steps together.",
        "Team, freeze. On three, slow turn, brave faces, trap low.",
      ],
      nervous: [
        "NOPE. I am not turning around. Somebody else can have the haunted neck today.",
        "Behind us? Great. Perfect. I love when the scary thing has good manners and sneaks up.",
        "Do not look yet. Actually, maybe look. No, wait. I hate this plan.",
        "If it taps my shoulder, I am becoming furniture.",
        "Tell the ghost personal space is still a rule.",
      ],
      tech: [
        "Rear anomaly confirmed. The strongest reading is directly behind our position.",
        "Backfield signal is climbing. Recommend controlled pivot in three seconds.",
        "Scanner shows movement at six o'clock. Keep the trap pointed low.",
        "Rear thermal dip detected. Rotate slowly and keep the beam steady.",
        "Six o'clock signal locked. Capture angle is awkward but possible.",
      ],
    },
    hear_something: {
      leader: [
        "Quiet. Everyone freeze and listen. We move only when we know where it is.",
        "Good catch. Hold the room and point to the sound source.",
        "Sound contact. Stay together and keep the trap hand ready.",
        "Everybody crouch low and listen. The ghost may be trying to sneak past.",
        "Mark the sound. One finger points, one hand holds the pretend blaster.",
      ],
      nervous: [
        "I heard it too, and I officially do not like the way it sounded.",
        "That was either a ghost or the house clearing its throat. Both are bad.",
        "Yep. Heard it. My knees just filed a complaint.",
        "I vote we call that noise suspicious and extremely rude.",
        "If that was the ghost saying hello, it needs better manners.",
      ],
      tech: [
        "Audio spike detected. Frequency pattern suggests nearby movement.",
        "Sound event logged. Triangulating from the loudest echo point.",
        "Acoustic reading is unstable. Repeat the noise check and keep talking.",
        "Echo bounce says the source is close to a wall or doorway.",
        "Noise signature confirmed. Scanner recommends a slow room sweep.",
      ],
    },
    another_one: {
      leader: [
        "Multiple targets. Stay close. We handle one at a time.",
        "New contact. Nobody runs. We tighten formation and keep eyes up.",
        "Second target confirmed. Reset the trap and prepare for a quick capture.",
        "More ghosts means slower feet and louder teamwork. Call out what you see.",
        "Team formation. Tall person in back, junior busters in the middle.",
      ],
      nervous: [
        "Another one? Of course there is another one. Why would there be just one nightmare?",
        "I was emotionally prepared for exactly zero ghosts, so this is a lot.",
        "More ghosts? Fantastic. Somebody tell them we are closed.",
        "Are they multiplying? I did not approve ghost math.",
        "I need everyone to know I am being very brave and only slightly melting.",
      ],
      tech: [
        "Additional entity detected. Count is no longer singular.",
        "Multiple readings on the scanner. Signal separation is messy but confirmed.",
        "New anomaly entered the field. Threat index has increased.",
        "Scanner shows overlapping signatures. Recommend single-target capture order.",
        "Entity count rising. Prioritize the loudest signal first.",
      ],
    },
    got_it: {
      leader: [
        "Good capture. Keep the trap closed and step back from it.",
        "Target secured. Nice work. Hold position until the room settles.",
        "Capture confirmed. Everybody breathe. We are back in control.",
        "Excellent work, team. Seal the trap and give the room one final scan.",
        "That was a clean catch. Junior busters, report your victory faces.",
        "Mission success. Do not poke the trap. It hates that.",
      ],
      nervous: [
        "We got it? Oh thank goodness. I was about to retire from pretend emergencies.",
        "Trap closed. Great. Nobody open that unless it signs paperwork.",
        "Yes. Beautiful. Wonderful. Please do not let it wiggle out.",
        "I have never been prouder or more ready for snacks.",
        "We caught it! I am celebrating quietly because loud celebrating attracts sequels.",
        "That was amazing. I only screamed on the inside, mostly.",
      ],
      tech: [
        "Containment confirmed. Residual readings are dropping.",
        "Trap seal looks stable. Entity signal is contained.",
        "Capture event logged. Threat level decreasing.",
        "Excellent containment. Room energy is returning to normal.",
        "Signal collapse confirmed. The ghost is inside the trap field.",
        "Victory metrics are excellent. Recommend high fives and trap storage.",
      ],
    },
    its_moving: {
      leader: [
        "It is moving. Track it, do not chase it. Keep the team together.",
        "Movement confirmed. Cut it off at the next doorway.",
        "Stay with it. Slow steps. We do not give it room to slip past.",
        "Follow the sound, not the panic. Point where it went.",
        "Move as one team. If it turns, we turn with it.",
      ],
      nervous: [
        "It moved? I was really hoping it was more of a sitting ghost.",
        "Why is it running? What does it know that we do not know?",
        "It is getting away, and somehow I am offended and terrified.",
        "Fast ghost. Bad feature. Very bad feature.",
        "Somebody ask it politely to stop being so athletic.",
      ],
      tech: [
        "Motion trail detected. Target velocity is increasing.",
        "Scanner shows lateral movement. Predicting path toward the open space.",
        "Entity is mobile. Recommend intercept angle, not direct pursuit.",
        "Movement vector points toward the nearest doorway.",
        "Tracking unstable. Use visual confirmation and short steps.",
      ],
    },
    it_got_away: {
      leader: [
        "It got away, but we are still in the fight. Reset and listen for the next sound.",
        "No problem. Escaped targets leave trails. Sweep the room from left to right.",
        "Regroup. Check doors, corners, and blankets. We can still catch it.",
        "It slipped out. Trap team reload, lookout team point to anything moving.",
        "Stay calm. A ghost on the run makes mistakes.",
      ],
      nervous: [
        "It got away? Cool. Cool cool cool. I was hoping for a longer scary adventure.",
        "It escaped. I respect its commitment and hate its choices.",
        "We lost it? Everybody act normal. By normal I mean extremely alert.",
        "It vanished again. That ghost is being very slippery and very rude.",
        "If it went upstairs, I am sending my bravest voice first.",
      ],
      tech: [
        "Containment failed. Residual trail remains active.",
        "Target escaped the capture cone. Searching for secondary signal.",
        "Entity trail detected. It moved fast but left a readable pattern.",
        "Trap missed by approximately one tiny ghost wiggle.",
        "Signal faded but did not disappear. Recommend renewed scan sweep.",
      ],
    },
    i_see_it: {
      leader: [
        "Visual confirmed. Keep eyes on it and call out where it goes.",
        "Good spot. Do not rush. Guide the trap toward it slowly.",
        "You have visual. Hold steady and keep the team behind you.",
        "Point to it. Everyone else gets ready for the trap count.",
        "Great find. Keep watching it while the trap team moves in.",
      ],
      nervous: [
        "You see it? Great. I will be over here bravely not seeing it.",
        "There it is? Wonderful. I hate when the invisible problem becomes visible.",
        "Visual contact. My official recommendation is tiny brave steps and no screaming. Maybe some screaming.",
        "If it makes eye contact, blink first. Or do not. I am not trained for ghost staring.",
        "Tell it we see it and we are very disappointed in its sneaking.",
      ],
      tech: [
        "Visual confirmation received. Scanner lock is improving.",
        "Target location acquired. Keep line of sight for three more seconds.",
        "Optical contact confirmed. Capture probability is rising.",
        "Line of sight established. Bring the trap within capture range.",
        "Visual signal is strong. Recommend immediate containment setup.",
      ],
    },
    where_did_it_go: {
      leader: [
        "Hold. If we lost it, we listen first. Check corners and doorways.",
        "Do not split up. Sweep the room from left to right.",
        "It disappeared. Stay calm and watch for anything moving by itself.",
        "Everybody stop walking. Sometimes the quiet tells us where it went.",
        "Look high, look low, then check the silly places ghosts think are clever.",
      ],
      nervous: [
        "It disappeared? That is the worst feature a ghost can have.",
        "I lost it too, which is exactly how every bad hallway story starts.",
        "Where did it go? Please let the answer be vacation.",
        "If it is invisible now, I am filing a complaint with ghost management.",
        "Nobody blink. Actually blinking is healthy. Blink, but suspiciously.",
      ],
      tech: [
        "Target signal dropped. Searching for residual trail.",
        "Visual lost. Scanner shows faint activity near the nearest corner.",
        "Entity signature faded. Recommend slow room scan and audio check.",
        "Signal scatter detected. It may be hiding behind a large object.",
        "No visual lock. Switch to sound tracking and temperature checks.",
      ],
    },
    trap_it: {
      leader: [
        "Open the trap on my count. Three, two, one, now.",
        "Trap team, forward. Everyone else step back and give it room.",
        "Set the trap low. Keep it steady. We only get one clean shot.",
        "Place the trap on the floor, point it at the ghost, and stomp the pretend pedal.",
        "Aim low. Ghosts drift down when the trap opens. Hold steady.",
        "Trap open. Count down loud. Five, four, three, two, one, close it.",
        "Do not throw it at the ghost. Put it where the ghost is going.",
        "Everybody say, into the trap. Then close it on three.",
      ],
      nervous: [
        "Open the trap? Yes. Great. Love opening the tiny box full of consequences.",
        "Throw the trap, but gently. Actually fast. Gentle and fast. Figure that out.",
        "Trap time. I am emotionally behind a couch, but professionally ready.",
        "Put the trap down and back away like it owes you money.",
        "If the trap starts wiggling, nobody ask it questions.",
        "Open it, close it, celebrate. That is my whole brave plan.",
        "Please aim the trap at the ghost and not at me. I am not haunted, just nervous.",
        "Trap goes on the floor. Screaming is optional but traditional.",
      ],
      tech: [
        "Trap aperture ready. Align it with the strongest reading.",
        "Containment field primed. Deploy when the signal peaks.",
        "Capture window is open. Place the trap within two steps of the target.",
        "Set trap orientation to floor-level intake. Begin countdown.",
        "Containment cone is strongest when the trap faces the movement path.",
        "Open field for five seconds, then seal. Do not exceed wiggle tolerance.",
        "Trap signal is green. Capture sequence may begin.",
        "Field polarity stable. Say the countdown clearly and close on one.",
      ],
    },
    coming_at_us: {
      leader: [
        "Brace. Nobody runs. Step aside and let it pass into the trap line.",
        "Incoming contact. Hold your ground and keep the trap open.",
        "It is charging. Shift left together and keep eyes forward.",
        "Team, sideways step. Make a lane straight into the trap.",
        "Hold the line. Big brave faces. Trap low and ready.",
      ],
      nervous: [
        "It is coming at us? That is my least favorite direction.",
        "No thank you, ghost. Personal space is still a rule.",
        "It is getting closer and my courage is buffering.",
        "If it hugs us, I am counting that as an attack.",
        "Everybody be brave. I will be brave immediately after this sentence.",
      ],
      tech: [
        "Approach vector confirmed. Distance is closing quickly.",
        "Entity acceleration detected. Prepare immediate containment.",
        "Threat reading is high. Recommend lateral move and trap deployment.",
        "Direct approach confirmed. Trap cone should face forward.",
        "Closing distance. Capture probability rises if nobody runs.",
      ],
    },
    hiding: {
      leader: [
        "Hiding ghost. Classic move. Check low first, then behind the big furniture.",
        "Nobody reaches under anything. Point, listen, then call it out.",
        "If it is hiding, we make the room boring. Quiet steps and steady lights.",
        "Check the blanket corners. Ghosts love dramatic fabric.",
        "Search pattern: couch, closet, curtain, then door.",
      ],
      nervous: [
        "It is hiding? Great. A ghost with strategy. I dislike smart spooky things.",
        "Please do not let it be under the bed. Beds are supposed to be neutral territory.",
        "If it is in the closet, I am sending in a very brave flashlight first.",
        "A hiding ghost is just a jump scare with patience.",
        "Everybody check the silly places. Ghosts love being ridiculous.",
      ],
      tech: [
        "Concealment behavior detected. Scanner reads strongest near covered objects.",
        "Signal is partially blocked. Check behind dense furniture.",
        "Thermal shadow suggests the entity is tucked behind something soft.",
        "Hide pattern confirmed. Begin close-range sweep.",
        "Object interference is high. Move slowly and rescan after each step.",
      ],
    },
    spooky_room: {
      leader: [
        "Environmental activity confirmed. Nobody touches the moving objects.",
        "Lights flickering means we slow down and control the room.",
        "Cold air, moving door, weird feeling. That is enough to start a sweep.",
        "Stand together in the center. We check one spooky thing at a time.",
        "If something moves by itself, point to it and keep your feet still.",
      ],
      nervous: [
        "The room is doing spooky room stuff. I would like the room to stop that.",
        "Cold air? Wonderful. Haunted air conditioning.",
        "If that door opens again, I am asking it to close itself politely.",
        "The toys moved? I do not like toys with schedules.",
        "This room has extremely suspicious vibes.",
      ],
      tech: [
        "Temperature drop confirmed. Possible entity presence nearby.",
        "Environmental disturbance logged. Watch the doorway and reflective surfaces.",
        "Object movement detected. Scanner recommends immediate room scan.",
        "Light fluctuation matches mild ghost activity.",
        "Room energy is uneven. Search from the coldest spot outward.",
      ],
    },
    slime: {
      leader: [
        "Slime contact. Do not touch your face. Mark the spot and step around it.",
        "Slime means the ghost passed through here. Follow the trail carefully.",
        "Everybody avoid the goo. Trap team, watch the direction it points.",
        "Good clue. Slime trail tells us where it went.",
        "No slipping. Tiny steps around the slime zone.",
      ],
      nervous: [
        "Slime? Oh good, the ghost left disgusting breadcrumbs.",
        "Please tell me that is ghost slime and not regular floor mystery.",
        "I am officially against touching goo from unknown dimensions.",
        "Nobody lick it. I cannot believe I have to say that.",
        "Slime on the floor is how the floor says, absolutely not.",
      ],
      tech: [
        "Ectoplasmic residue detected. Trail direction may reveal target movement.",
        "Slime sample indicates recent ghost passage.",
        "Residue is fresh. Scanner confidence is increasing.",
        "Goo pattern suggests a fast turn near this location.",
        "Ectoplasm field active. Containment may be close.",
      ],
    },
    scared: {
      leader: [
        "It is okay to be scared. Brave means we stay together and take one small step.",
        "Everybody breathe in, breathe out. You are doing great.",
        "No one has to go first alone. We move as one team.",
        "Fear check complete. Hands ready, feet slow, voices calm.",
        "You are safe with the team. Point to the sound and we will handle it together.",
      ],
      nervous: [
        "I am scared too, which means we are a very honest ghost team.",
        "Tiny bit scared is allowed. Full panic is scheduled for later.",
        "My bravery is warming up. Give it one second.",
        "We can be scared and still boss this ghost around.",
        "If your knees wiggle, that is just your courage charging.",
      ],
      tech: [
        "Heart-rate spike expected. Recommend slow breathing and team formation.",
        "Fear response normal. Scanner still shows manageable activity.",
        "Team stability improves when everyone stays within arm's reach.",
        "Confidence protocol: breathe, point, report, capture.",
        "No danger spike detected. Proceed with careful investigation.",
      ],
    },
    call_for_help: {
      leader: [
        "Backup is on the line. You are the field team. Tell me what you see.",
        "We are with you. Start with the loudest sound and move slowly.",
        "Help is here. First instruction: stay together.",
        "Copy that. Dispatch is active. Give me the ghost location.",
        "You called the right team. Keep the trap ready and report the next clue.",
      ],
      nervous: [
        "Backup heard you, and backup is emotionally available.",
        "We are coming in over the radio, which is safer than coming in through the haunted door.",
        "Help is here. By here, I mean in your ear, bravely supervising.",
        "I have alerted the very serious spooky department, which is mostly us.",
        "Stay calm. I am only panicking professionally.",
      ],
      tech: [
        "Remote support connected. Begin field report.",
        "Dispatch channel open. Scanner data will update as you describe the room.",
        "Assistance confirmed. Need target direction, sound, and movement status.",
        "Support link stable. Proceed with observation protocol.",
        "Backup mode active. Awaiting your next ghost report.",
      ],
    },
    scan_it: {
      leader: [
        "Scanner pass. Point it slowly across the room and stop where it beeps the loudest.",
        "Check the meter, then check the nearest doorway.",
        "Run a slow scan from floor to ceiling. No rushing the equipment.",
        "Tell me when the scanner gets loud. That is where we set the trap.",
        "Sweep left, sweep right, then hold on the strongest reading.",
      ],
      nervous: [
        "The scanner says beep, which is science for uh oh.",
        "If the meter goes crazy, I am going calm. Probably. Maybe.",
        "I love scanners because they scream before I do.",
        "The reading is spooky with a chance of absolutely not.",
        "If it beeps louder, please remind the ghost we have plans later.",
      ],
      tech: [
        "Scanner online. Begin a slow horizontal sweep.",
        "Reading is faint. Move two steps and rescan.",
        "Meter activity suggests a class silly anomaly.",
        "Signal strength improves near corners and fabric surfaces.",
        "PKE-style reading is active. Hold position while it stabilizes.",
      ],
    },
    celebrate: {
      leader: [
        "Excellent work. Team victory. Secure the trap and celebrate after the final scan.",
        "Mission complete. High fives authorized.",
        "You handled that like professionals. Room sweep complete.",
        "Great teamwork. The house is officially less spooky.",
        "Victory confirmed. Everyone gets a bravery point.",
      ],
      nervous: [
        "We won? Amazing. I believed in us almost the whole time.",
        "High fives, but gently. My nerves are still wearing a helmet.",
        "That ghost picked the wrong family.",
        "I am proud, relieved, and only a little sweaty.",
        "We saved the room. I would like to save a snack next.",
      ],
      tech: [
        "Victory logged. Spooky readings are within normal range.",
        "Mission metrics excellent. Capture team performed above expectations.",
        "Final scan clear. Celebration protocol approved.",
        "Room status: safe, stable, and impressively defended.",
        "Success confirmed. Recommend trap storage and team applause.",
      ],
    },
    safe_now: {
      leader: [
        "All clear for now. Keep the trap closed and walk the room one last time.",
        "Safe enough to breathe. Do a final corner check before you relax.",
        "The room is clear. Nice work staying together.",
        "Stand down, team. Keep listening, but the big danger is gone.",
        "You can come out. Move slowly and give the room one brave look.",
      ],
      nervous: [
        "Safe? Mostly. I am giving it a ninety percent safe and ten percent suspicious lamp.",
        "It feels safer, which is my favorite kind of feeling.",
        "I think we are clear. If a ghost disagrees, it can schedule an appointment.",
        "You can relax your shoulders now. Mine are still near my ears.",
        "All clear, but I am still side-eyeing the closet.",
      ],
      tech: [
        "All-clear reading confirmed. Residual activity is minimal.",
        "Scanner shows low threat. Final sweep recommended.",
        "Room energy stabilized. Safe status is likely.",
        "No active target detected. Keep trap sealed for transport.",
        "Threat level low. Monitoring can continue from a safe distance.",
      ],
    },
  },

  fallback: [
    "Say that again. My scanner spiked.",
    "I'm getting weird readings, but no clear target.",
    "Keep talking. Something here is reacting.",
    "I don't like the energy in this room.",
    "Describe what you hear, see, or smell. The ghost may be giving us clues.",
    "Copy. Give me one detail: sound, movement, slime, or hiding spot.",
    "The signal is fuzzy. Try telling me where the ghost is.",
    "I need a cleaner report. Is it moving, hiding, coming closer, or trapped?",
    "That is spooky enough to investigate. Keep going.",
    "Field team, repeat that with one ghost clue attached.",
  ],

  flavorLines: [
    "I'm not getting paid enough for this.",
    "This is going in the report.",
    "We should've brought more people.",
    "Next time, we stay in the car.",
    "I really hate this job sometimes.",
    "Somebody remind me to label the trap this time.",
    "If anyone asks, this was absolutely under control.",
    "The paperwork on this one is going to be weird.",
    "I knew I should have packed the extra flashlight.",
    "This house has opinions, and I do not like them.",
  ],

  threatLines: {
    medium: [
      "Stay sharp.",
      "Keep the trap close.",
      "Nobody wanders off.",
      "Team voices only. No ghost voices allowed.",
    ],
    high: [
      "This is a high-threat reading. Move together now.",
      "Everybody stay tight. We are in the spooky zone.",
      "No solo hero moves. Trap team takes the lead.",
      "Fast plan: point, trap, count, close.",
    ],
  },
};

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[.,!?]/g, "")
    .replace(/\b(uh|um|hey|okay|ok|so|like|please)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
