import { usePrompt } from "@/app/_components/PromptContext";

export type BurnerQuestionnaireResult = {
  dreams_hopes_plans: string;
  age: string;
  country: string;
  certainty: string;
  arrival_time: string;
  departure_time: string;
  previous_events: string;
  borderland_visits: string;
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
    prompt(
      "First, please answer the following questions.",
      [
        {
          key: "dreams_hopes_plans",
          label:
            "1. Anything you want to share about your dreams, hopes or plans for your Borderland participation this year?",
          type: "textWithTopLabel",
          multiLine: true,
          canBeEmpty: true,
        },
        {
          key: "age",
          label: "2. What's your age?",
          type: "textWithTopLabel",
        },
        {
          key: "country",
          label: "3. In which country do you currently reside?",
          type: "textWithTopLabel",
        },
        {
          key: "certainty",
          label: "4. How certain do you feel of going? No judgment!",
          type: "radio",
          options: [
            {
              id: "never_more_certain",
              label: "I've never felt more certain of anything in my life!",
            },
            {
              id: "pretty_certain",
              label: "Pretty certain",
            },
            {
              id: "likely_go",
              label: "I'll likely go, but you never know",
            },
            {
              id: "maybe",
              label:
                "Maybe I don't, maybe I do - I want to keep my options open!",
            },
            {
              id: "likely_not",
              label: "I'll likely not go",
            },
          ],
        },
        {
          key: "arrival_time",
          label:
            "5. When do you plan to arrive? If you don't know yet, choose your best guess.",
          type: "radio",
          options: [
            {
              id: "early",
              label: "Arriving earlier to build stuff and help out",
            },
            {
              id: "normal",
              label: "Arriving between Sunday and Monday",
            },
            {
              id: "late",
              label: "Arriving Tuesday or later",
            },
            {
              id: "weekend",
              label: "Only there for the weekend",
            },
          ],
        },
        {
          key: "departure_time",
          label:
            "6. When do you plan to leave? If you don't know yet, choose your best guess",
          type: "radio",
          options: [
            { id: "before_sunday", label: "Before Sunday (but why..?)" },
            { id: "sunday", label: "Sunday" },
            { id: "monday", label: "Monday or later (LNT is sexy!)" },
          ],
        },
        {
          key: "previous_events",
          label:
            "7. How many events based on the 10 (11) principles have you (approximately) been to before? (e.g. Burning Man, Nowhere, The Borderland, ...)",
          type: "textWithTopLabel",
        },
        {
          key: "borderland_visits",
          label:
            "8. How many times have you (approximately) been to The Borderland before?",
          type: "textWithTopLabel",
        },
        {
          key: "experiment_awareness",
          label:
            "9. Are you aware of the fact that you're heading straight into a radical experiment in community, co-creation and creativity?",
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
          label: "10. Who is responsible for the Borderland to happen?",
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
            { id: "that_guy", label: "That guy *pointing*" },
            {
              id: "questionnaire",
              label: "Probably the one who created this endless questionnaire",
            },
          ],
        },
        {
          key: "volunteer_interests",
          label:
            "11. Would you like to be part of any of these teams of heroes?",
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
            { id: "conflict_resolution", label: "Conflict resolution team" },
          ],
        },
        {
          key: "clown_police_duties",
          label: "12. What does the clown police do?",
          type: "checkboxGroup",
          options: [
            { id: "keep_everyone_safe", label: "Help to keep everyone safe" },
            { id: "advise_and_educate", label: "Advise and educate" },
            {
              id: "wear_a_cute_clown_costume",
              label: "Wear a cute clown costume to be easily identifiable",
            },
            {
              id: "support_people_in_making_decisions",
              label:
                "Support people in making decisions based on community standards",
            },
            {
              id: "be_sober_alert_and_approachable",
              label: "Be sober, alert and approachable",
            },
            { id: "be_silly_and_playful", label: "Be silly and playful" },
            { id: "all", label: "All of the above!" },
          ],
        },
        {
          key: "clown_police_eligibility",
          label: "13. Can anyone with a membership become a clown police?",
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
          label: "14. Do you have a dream for this year's Borderland?",
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
          label: "15. Are you part of a camp?",
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
              label:
                "What's camp? Isn't that a super cool aesthetic expression?",
            },
          ],
        },
        {
          key: "sound_camp_approach",
          label: "16. What do you do if you want to start a sound camp?",
          type: "radio",
          options: [
            {
              id: "discord",
              label:
                "Go to Borderlands Discord channel and propose it as a co-created idea",
            },
            {
              id: "facebook",
              label: "Go to Borderlands Facebook page to find collaborators",
            },
            {
              id: "guide",
              label: "Check the Survival Guide for guidance",
            },
            {
              id: "kidsville",
              label:
                'Put a big speaker in Kidsville and scream "RADICAL SELF EXPRESSION"',
            },
            {
              id: "pr",
              label: "Hire famous DJs and make a PR campaign",
            },
          ],
        },
        {
          key: "food_awareness",
          label:
            "17. Did you know you have to bring all your own food and drinks to the Borderland?",
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
          label: "18. Which of the 10 (11) principles is your favorite?",
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
          label: "19. What does 'Leave No Trace' mean?",
          type: "checkboxGroup",
          options: [
            {
              id: "pack_it_in_pack_it_out",
              label:
                "I will pack everything I brought in and take it out with me",
            },
            {
              id: "pick_up_moop",
              label: "I will pick up and take care of any MOOP I see on site",
            },
            {
              id: "no_moop_left_behind",
              label: "I will not leave MOOP around the site",
            },
            {
              id: "poop_in_toilets",
              label: "I won't poop anywhere but in the toilets",
            },
            {
              id: "remind_others",
              label: "I will remind others about MOOP responsibility",
            },
            { id: "all", label: "All of the above!" },
          ],
        },
        {
          key: "nature_reserve_awareness",
          label: "20. Are you aware of the nature reserve rules in Alversjö?",
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
                "I knew about the reserve, but not about the rules. I will learn them!",
            },
            {
              id: "no",
              label:
                "No, but I will read the Survival Guide and educate myself!",
            },
          ],
        },
        {
          key: "consent_understanding",
          label: "21. What does consent mean at the Borderland?",
          type: "checkboxGroup",
          options: [
            {
              id: "yes",
              label: "Only yes means yes!",
            },
            {
              id: "consent_can_be_revoked",
              label: "Consent can be revoked at any time",
            },
            {
              id: "nudity_and_sexy_costume",
              label: "Nudity is not an invitation to touch",
            },
            {
              id: "not_owed_anything",
              label: "I'm not owed anything by anyone",
            },
            {
              id: "can_just_ask",
              label: "I can just ask and handle a 'no'",
            },
            {
              id: "ok_to_check_in",
              label: "It's OK to check in if something looks non-consensual",
            },
            {
              id: "get_permission",
              label: "I'll get permission before taking photos",
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
            "22. What do you need to bring to be let in by the Threshold gate crew?",
          type: "radio",
          options: [
            {
              id: "nothing",
              label: "Nothing, everybody knows who I am already",
            },
            {
              id: "id",
              label:
                "A valid ID (bring the physical version!) and membership QR code",
            },
            {
              id: "check",
              label:
                "I'll double-check the survival guide to make sure I have everything I need",
            },
          ],
        },
        {
          key: "questionnaire_understanding",
          label:
            "23. Are you aware that this questionnaire is just an attempt at describing the Borderland?",
          type: "checkboxGroup",
          options: [
            {
              id: "decentralized",
              label: "Yes, Borderland is fully decentralized madness",
            },
            { id: "great", label: "No, you're doing great!" },
            {
              id: "impossible",
              label:
                "Yes, it's impossible to describe something always in process",
            },
            {
              id: "tired",
              label: "Yes, and I'm tired of it. Let's meet on Discord!",
            },
          ],
        },
      ],
      ({ unfinishedFieldIndices }) => {
        if (unfinishedFieldIndices.length === 0) return "Submit";

        if (unfinishedFieldIndices.length <= 5) {
          return `You still need to answer question${unfinishedFieldIndices.length === 1 ? "" : "s"} ${unfinishedFieldIndices.map((i) => `#${i + 1}`).join(", ")}`;
        }

        return "Please answer all the questions";
      },
      false, // closeOnBackdropClick: prevent closing when clicking background
    );
};
