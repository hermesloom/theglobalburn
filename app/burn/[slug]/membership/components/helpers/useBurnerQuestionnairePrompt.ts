import { usePrompt } from "@/app/_components/PromptContext";

export type BurnerQuestionnaireResult = {
  country: string;
  arrival_time: string;
  departure_time: string;
  previous_events: string;
  borderland_visits: string;
  education: string;
  experiment_awareness: string;
  responsibility: string;
  volunteer_interests: string;
  clown_police_duties: string;
  clown_police_eligibility: string;
  dream_status: string;
  camp_status: string;
  sound_camp_approach: string;
  food_awareness: string;
  favorite_principle: string;
  lnt_understanding: string;
  nature_reserve_awareness: string;
  consent_understanding: string;
  entry_requirements: string;
  questionnaire_understanding: string;
};

export const useBurnerQuestionnairePrompt = () => {
  const prompt = usePrompt();

  return () =>
    prompt("First, please answer the following questions.", [
      {
        key: "country",
        label: "1. In which country do you currently reside?",
        type: "textWithTopLabel",
      },
      {
        key: "arrival_time",
        label: "2. When do you plan to arrive?",
        type: "radio",
        options: [
          {
            id: "early",
            label: "Arriving earlier to build stuff and help out (like a boss)",
          },
          {
            id: "normal",
            label: "Arriving between Sunday and Monday (like a normal person)",
          },
          { id: "late", label: "Arriving Tuesday or later (like a tourist)" },
          {
            id: "weekend",
            label: "Only there for the weekend (what am I even doing here?)",
          },
        ],
      },
      {
        key: "departure_time",
        label: "3. When do you plan to leave?",
        type: "radio",
        options: [
          { id: "before_sunday", label: "Before Sunday (but why..?)" },
          { id: "sunday", label: "Sunday" },
          { id: "monday", label: "Monday (LNT is sexy!)" },
        ],
      },
      {
        key: "previous_events",
        label:
          "4. How many events based on the 10 (11) principles have you been to before? (e.g. Burning Man, Nowhere, The Borderland, ...)",
        type: "textWithTopLabel",
      },
      {
        key: "borderland_visits",
        label: "5. How many times have you been to The Borderland before?",
        type: "textWithTopLabel",
      },
      {
        key: "education",
        label: "6. What's your highest level of completed education?",
        type: "radio",
        options: [
          { id: "bachelors", label: "Bachelor's degree" },
          { id: "masters", label: "Master's degree" },
          { id: "primary", label: "Primary education (up to 10 years)" },
          {
            id: "secondary",
            label: "Secondary education (10 years or more)",
          },
          { id: "technical", label: "Technical or vocational certification" },
          { id: "phd", label: "PhD" },
          { id: "none", label: "No formal education completed" },
        ],
      },
      {
        key: "experiment_awareness",
        label:
          "7. Are you aware of the fact that you're heading straight into a radical experiment in community, co-creation and creativity?",
        type: "checkboxGroup",
        options: [
          { id: "yes_no_spectators", label: "Yes, there are no spectators" },
          {
            id: "yes_discord",
            label: "Love that stuff, see you on Discord!",
          },
          {
            id: "no",
            label:
              "No, but I'll read about it in the survival guide right away",
          },
        ],
      },
      {
        key: "responsibility",
        label: "8. Who is responsible for the Borderland to happen?",
        type: "radio",
        options: [
          {
            id: "all",
            label: "All members of the Borderland are doing it together!",
          },
          {
            id: "margrethe",
            label:
              "Margrethe II of Denmark (that's why we have sponsored ballet classes)",
          },
          { id: "chatgpt", label: "ChatGPT" },
          { id: "that_guy", label: "That guy *pointing*" },
          { id: "vito", label: "Vito Corleone and the family" },
          {
            id: "questionnaire",
            label: "Probably the one who created this endless questionnaire",
          },
        ],
      },
      {
        key: "volunteer_interests",
        label:
          "9. There are a lot of ways to engage in the Borderland on site, and some super important factions that keep the event rolling. To join one of these is also an amazing (and fun!) way to connect with new people and involve yourself in the community! Would you like to be part of any of these teams of heroes?",
        type: "checkboxGroup",
        options: [
          { id: "clown_police", label: "Clown police" },
          { id: "sanctuary", label: "Sanctuary" },
          { id: "toilets", label: "Toilets and sanitation" },
          { id: "moopicorns", label: "MOOPicorns" },
          { id: "consent", label: "Consent and awareness" },
          {
            id: "threshold",
            label:
              "Threshold (The gate crew with black vests who checks memberships)",
          },
          { id: "electricity", label: "Electricity" },
        ],
      },
      {
        key: "clown_police_duties",
        label: "10. What does the clown police do?",
        type: "checkboxGroup",
        options: [
          { id: "keep_everyone_safe", label: "help to keep everyone safe" },
          { id: "advise_and_educate", label: "advise and educate" },
          {
            id: "wear_a_cute_clown_costume",
            label: "wear a cute clown costume to be easily identifiable",
          },
          {
            id: "support_people_in_making_decisions",
            label:
              "support people in making decisions based on community standards",
          },
          {
            id: "be_sober_alert_and_approachable",
            label: "be sober, alert and approachable",
          },
          { id: "be_silly_and_playful", label: "be silly and playful" },
          { id: "all", label: "All of the above!" },
        ],
      },
      {
        key: "clown_police_eligibility",
        label:
          "11. Sounds great, doesn't it? Can anyone with a membership become a clown police?",
        type: "radio",
        options: [
          { id: "veterans", label: "No, only veterans." },
          {
            id: "yes",
            label: "Yes, it's a great way to be part of the Borderland!",
          },
          {
            id: "signup",
            label:
              "Yes, even me! And I want to receive the link to the signup sheet.",
          },
        ],
      },
      {
        key: "dream_status",
        label: "12. Do you have a dream for this year's Borderland?",
        type: "radio",
        options: [
          {
            id: "ready",
            label:
              "Yes, I have my own dream and I have already written a description and a budget",
          },
          {
            id: "working",
            label: "Yes, but I'm still working out the details",
          },
          {
            id: "joining",
            label: "No, but I'm joining another dreamer's project",
          },
          {
            id: "helping",
            label:
              "No, but I will make myself useful in other ways (Clown Police, etc.)",
          },
          {
            id: "learning",
            label:
              "Dreams? What's that? I'll read all about it on the dreams-page/in the survival guide",
          },
        ],
      },
      {
        key: "camp_status",
        label: "13. Are you part of a camp?",
        type: "radio",
        options: [
          { id: "free", label: "No, I'm free-camping" },
          {
            id: "small",
            label: "Yes, I'm part of a small camp (less than 15 people)",
          },
          {
            id: "big",
            label: "Yes, I'm part of a big camp (more than 15 people)",
          },
          {
            id: "looking",
            label: "Not yet, but I'm looking for a camp to join",
          },
          {
            id: "what",
            label: "What's camp? Isn't that a super cool aesthetic expression?",
          },
        ],
      },
      {
        key: "sound_camp_approach",
        label:
          "14. So, you want to start a sound camp to bring that old school disco back to the Borderland. What do you do?",
        type: "radio",
        options: [
          {
            id: "discord",
            label:
              "I go to Borderlands Discord channel and propose the sound-camp as a part of the co-created mish-mash",
          },
          {
            id: "facebook",
            label:
              "Go to Borderlands Facebook page to see if someone wants to help out",
          },
          {
            id: "guide",
            label:
              "Check in the Survival Guide to see if there are any pointers there",
          },
          {
            id: "kidsville",
            label:
              'I put a big ass speaker in the middle of Kidsville and scream "RADICAL SELF EXPRESSION"',
          },
          {
            id: "pr",
            label:
              "Hire famous DJs and make a fancy PR campaign to get the crowd hyped",
          },
        ],
      },
      {
        key: "food_awareness",
        label:
          "15. Did you know you have to bring all your own food and drinks to the Borderland?",
        type: "radio",
        options: [
          {
            id: "yes",
            label:
              "Yes, and I'll bring my own fun too! I'm all on board with radical self-reliance!",
          },
          {
            id: "no",
            label:
              "No, but I'll read about it in the survival guide right away!",
          },
        ],
      },
      {
        key: "favorite_principle",
        label:
          "16. The Borderland is informed by a set of guidelines known as the 10 (11) principles. Which one is your favorite?",
        type: "checkboxGroup",
        options: [
          { id: "reliance", label: "Radical self-reliance" },
          { id: "gifting", label: "Gifting" },
          { id: "expression", label: "Radical self-expression" },
          { id: "decommodification", label: "Decommodification" },
          { id: "inclusion", label: "Radical inclusion" },
          { id: "effort", label: "Communal effort" },
          { id: "responsibility", label: "Civic responsibility" },
          { id: "lnt", label: "Leave no trace" },
          { id: "participation", label: "Participation" },
          { id: "immediacy", label: "Immediacy" },
          { id: "consent", label: "Consent" },
          {
            id: "learning",
            label:
              "I haven't heard about them but will read about it straight away",
          },
        ],
      },
      {
        key: "lnt_understanding",
        label:
          "17. Leaving No Trace is an important Borderland principle. What does it mean?",
        type: "checkboxGroup",
        options: [
          {
            id: "pack_it_in_pack_it_out",
            label:
              "I will pack everything I brought in and take it out with me, including my rubbish and recycling.",
          },
          {
            id: "pick_up_moop",
            label:
              "I will pick up and take care of any Matter Out Of Place (MOOP) I see on site, even if I didn't make it.",
          },
          {
            id: "no_moop_left_behind",
            label: "I will not leave MOOP around the site.",
          },
          {
            id: "poop_in_toilets",
            label: "I won't poop anywhere but in the toilets.",
          },
          {
            id: "remind_others",
            label:
              "I will gently remind others to take care of their MOOP if I see it on the site.",
          },
          { id: "all", label: "All of the above!" },
        ],
      },
      {
        key: "nature_reserve_awareness",
        label:
          "18. Are you aware that The Borderland in Alversjö is surrounded by a nature reserve, and that we should not camp, make fires or build things there?",
        type: "radio",
        options: [
          {
            id: "yes",
            label:
              "Yes, and I know about the responsibilities that come with it :)",
          },
          {
            id: "partial",
            label:
              "I knew about the reserve, but not about the rules. I will make sure I know about it!",
          },
          {
            id: "no",
            label:
              "No I didn't know that, but I will read the Survival Guide and educate myself!",
          },
        ],
      },
      {
        key: "consent_understanding",
        label:
          "19. Consent is the unofficial 11th principle of the Borderland. What does it mean?",
        type: "checkboxGroup",
        options: [
          {
            id: "yes",
            label:
              "Only yes means yes! Not everyone is comfortable saying 'no' directly",
          },
          {
            id: "consent_can_be_revoked",
            label:
              "Consent can be revoked at any time, even if something else was agreed upon before",
          },
          {
            id: "nudity_and_sexy_costume",
            label: "Nudity and sexy costume is not an invitation to touch",
          },
          {
            id: "not_owed_anything",
            label:
              "I'm not owed anything by anyone, and I will gracefully accept a 'no'",
          },
          {
            id: "can_just_ask",
            label:
              "I can just ask if there's something I want, I can deal with getting a 'no'",
          },
          {
            id: "ok_to_check_in",
            label:
              "It's OK for me to check in if I see something that looks non-consensual",
          },
          {
            id: "get_permission",
            label:
              "I'll get permission from everyone in the frame before taking photos",
          },
          {
            id: "all",
            label: "All of the above!",
          },
        ],
      },
      {
        key: "entry_requirements",
        label:
          "20. What do you need to bring to the event to be let in by the Threshold gate crew?",
        type: "radio",
        options: [
          {
            id: "nothing",
            label: "Nothing, everybody in the world knows who I am already",
          },
          {
            id: "id",
            label:
              "A valid ID and my membership QR code (downloaded or printed in advance)",
          },
          {
            id: "check",
            label:
              "What? I thought we are free souls and shouldn't need any of that stuff. I'll double-check the survival guide to make sure I have everything I need when arriving at the gate.",
          },
        ],
      },
      {
        key: "questionnaire_understanding",
        label:
          "21. Are you aware of the fact that this questionnaire is but a failed attempt at explaining the beautiful chaos that is the Borderland?",
        type: "checkboxGroup",
        options: [
          {
            id: "decentralized",
            label:
              "Yes, Borderland is a fully decentralized madness with no formal authority",
          },
          { id: "great", label: "No, you're doing great! Hooray for you!" },
          {
            id: "impossible",
            label:
              "Yes, it's impossible to briefly describe an event that is always in the process, and never fixed.",
          },
          {
            id: "tired",
            label:
              "Yes, and I'm super tired of it. Let's meet on Discord to organize stuff instead!",
          },
        ],
      },
    ]);
};
