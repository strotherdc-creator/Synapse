/**
 * Quick-Start Topic Profiles
 *
 * 8 pre-built condition topics for doctors who haven't completed their modules.
 * Each topic is positioned from a CORRECTIVE chiropractic lens:
 * - Internal: We find subluxations, correct structure, restore function.
 * - Patient-facing: "We find the real problem, fix it, and get you back to where you should be."
 * - NOT symptomatic/pain management. NOT "just cracking backs."
 *
 * Each profile provides pre-filled answers that mirror what the modules would produce,
 * so the daily plan engine can generate useful coaching cards, social posts,
 * video scripts, and referral language even for day-1 users.
 */

export interface QuickStartTopic {
  id: string;
  label: string;
  shortLabel: string;
  description: string;

  // Pre-filled module answers (as if the doctor completed modules with this focus)
  idealPatient: string;
  topProblems: string[];
  desiredOutcome: string;
  oneSentenceDifference: string;
  localPosition: string;
  knownForSentence: string;
  pillarPhrases: string[];
  tableTalkOneLiners: string[];
  patientStory: string;
  referralTriggerLine: string;
  easyIntroLine: string;
  communityLane: string;

  // Content generation assets
  socialPostTemplates: string[];
  videoTopics: string[];
  imagePromptTemplates: string[];
  photoSuggestions: string[];
}

export const QUICK_START_TOPICS: QuickStartTopic[] = [
  {
    id: "chronic_low_back_pain",
    label: "Chronic Low Back Pain",
    shortLabel: "Low Back",
    description: "People who've had low back pain for months or years and are tired of being told to just live with it.",
    idealPatient: "Adults 30-60 with chronic low back pain who have tried everything — meds, PT, injections — and still hurt. They want a real answer, not another band-aid.",
    topProblems: [
      "Chronic low back pain that won't go away",
      "Recurring episodes that keep getting worse",
      "Being told 'it's just your age' or 'learn to live with it'"
    ],
    desiredOutcome: "Get back to living without constantly thinking about their back — play with their kids, exercise, sleep through the night.",
    oneSentenceDifference: "We help people with chronic low back pain find out what's actually wrong and fix it — so they stop managing pain and start living again.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for solving chronic low back pain that nobody else could figure out.",
    pillarPhrases: [
      "We find it. We fix it. You get your life back.",
      "Pain is a signal, not a sentence.",
      "If no one's found the real problem yet, that's exactly why we're here."
    ],
    tableTalkOneLiners: [
      "They actually found what was causing my back pain — not just where it hurt.",
      "I'd been to three other places. They're the ones who finally fixed it.",
      "They don't just crack your back. They figure out why it keeps going out.",
      "I can sleep through the night again. I didn't think that was possible.",
      "They showed me exactly what was wrong and had a plan to correct it."
    ],
    patientStory: "They came in after 8 years of low back pain — had tried injections, PT, even talked to a surgeon. We found a structural shift in their lower spine that nobody had addressed. After 12 weeks of corrective care, they're back to running 3 miles without thinking about their back.",
    referralTriggerLine: "If you know someone who's been dealing with low back pain and nobody can figure it out — send them in. This is exactly what we do.",
    easyIntroLine: "Go see Dr. ______. They're the ones who actually fix chronic back pain when nothing else has worked.",
    communityLane: "Gyms & fitness communities",
    socialPostTemplates: [
      "If your low back pain keeps coming back, it's not because you need another adjustment. It's because nobody found the real problem yet.\n\nWe don't chase pain. We find the structural cause and correct it.\n\nThat's the difference between feeling better for a week and actually getting better.\n\n#ChiropracticCare #LowBackPain #CorrectiveCare #SpineHealth",
      "\"I've had this for years. I just figured it was normal.\"\n\nIt's not normal. It's a sign something structural hasn't been addressed.\n\nWe find it. We fix it. You get your life back.\n\nDM me if this sounds like you or someone you know.",
      "3 signs your low back pain is a structural problem (not just tight muscles):\n\n1. It keeps coming back no matter what you do\n2. It's getting worse over time, not better\n3. Nobody can tell you exactly what's wrong\n\nIf that's you — we should talk. Link in bio."
    ],
    videoTopics: [
      "Why your low back pain keeps coming back (and what nobody's checking)",
      "The difference between pain relief and actually fixing the problem",
      "What I look for that most doctors miss in chronic low back cases"
    ],
    imagePromptTemplates: [
      "Professional chiropractor examining a patient's lower spine with focused attention, clean modern clinic, warm lighting, corrective care environment",
      "Before and after posture comparison showing structural improvement, clinical setting, professional photography",
      "Doctor pointing to a spine model explaining a structural problem to an engaged patient"
    ],
    photoSuggestions: [
      "You at your desk reviewing a patient's X-rays or posture scan",
      "You explaining something on a spine model to a patient (get permission)",
      "Your adjustment table or exam room — clean, professional, inviting"
    ]
  },
  {
    id: "sciatica",
    label: "Sciatica & Leg Pain",
    shortLabel: "Sciatica",
    description: "People with shooting pain, numbness, or tingling down their leg who are scared of surgery.",
    idealPatient: "Adults with sciatica or radiating leg pain who've been told they might need surgery or injections. They want a non-surgical solution that actually addresses the cause.",
    topProblems: [
      "Shooting pain down the leg that won't let up",
      "Numbness or tingling that's getting worse",
      "Being told surgery is the only option"
    ],
    desiredOutcome: "Walk, sit, and sleep without that shooting pain — and know the problem is actually being fixed, not just masked.",
    oneSentenceDifference: "We help people with sciatica find the structural cause of their nerve pain and correct it — without surgery, without injections, without just waiting and hoping.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for helping people avoid surgery by actually fixing what's causing their sciatica.",
    pillarPhrases: [
      "Nerve pain has a cause. We find it and fix it.",
      "Surgery should be the last resort, not the first suggestion.",
      "Your body can heal — if the pressure is removed."
    ],
    tableTalkOneLiners: [
      "I was about to schedule surgery. They found what was pressing on my nerve and fixed it.",
      "The shooting pain down my leg is gone. I can actually drive again.",
      "They didn't just tell me to stretch. They found the real problem.",
      "I can feel my foot again. I thought that was permanent.",
      "They showed me exactly what was causing the nerve pain."
    ],
    patientStory: "They came in barely able to walk — shooting pain from their hip to their foot, couldn't sit for more than 10 minutes. A surgeon had recommended a discectomy. We found a structural shift putting direct pressure on the nerve root. After 8 weeks of corrective care, the pain was gone and they cancelled the surgery.",
    referralTriggerLine: "If you know someone dealing with sciatica or leg pain and they're being told surgery is the answer — send them in first. We might be able to fix it without cutting.",
    easyIntroLine: "Go see Dr. ______. They fix sciatica without surgery. Seriously.",
    communityLane: "Employers & workplace wellness",
    socialPostTemplates: [
      "Sciatica isn't a diagnosis. It's a symptom.\n\nThe real question is: what's pressing on that nerve?\n\nWe find it. We correct it. The pain goes away because the CAUSE goes away.\n\nIf you're dealing with shooting leg pain — don't just mask it. Fix it.\n\n#Sciatica #NervePain #CorrectiveCare #NoSurgery",
      "\"The surgeon said I needed an operation.\"\n\nWe said: let us look first.\n\nWe found a structural shift pressing directly on the nerve. 8 weeks of corrective care later — surgery cancelled.\n\nNot every case avoids surgery. But every case deserves a second look.\n\nDM me if this is you.",
      "3 things most people don't know about sciatica:\n\n1. It's not caused by a \"tight piriformis\" in most cases\n2. The nerve pain is a signal — something structural is pressing on it\n3. If you fix the structure, the nerve heals itself\n\nWe specialize in finding and fixing that structural cause."
    ],
    videoTopics: [
      "Why stretching alone won't fix your sciatica (and what will)",
      "The #1 thing I check in every sciatica case that most doctors skip",
      "How we help people cancel their back surgery"
    ],
    imagePromptTemplates: [
      "Chiropractor examining a patient's lower back and hip area, professional clinical setting, focused diagnostic approach",
      "Anatomical illustration showing nerve compression in the lumbar spine, clean educational style",
      "Patient walking comfortably after treatment, bright natural lighting, recovery and relief"
    ],
    photoSuggestions: [
      "You performing a specific exam on a patient's leg (straight leg raise or similar)",
      "A spine model showing where nerve compression happens",
      "A patient testimonial card (with permission) about avoiding surgery"
    ]
  },
  {
    id: "disc_bulges",
    label: "Disc Bulges & Herniations",
    shortLabel: "Disc Issues",
    description: "People diagnosed with bulging or herniated discs who are scared and confused about their options.",
    idealPatient: "Adults 35-55 diagnosed with a disc bulge or herniation on MRI who are in pain, scared, and being told their only options are injections or surgery.",
    topProblems: [
      "Diagnosed with a disc bulge/herniation and don't know what to do",
      "Severe pain that limits everything — work, sleep, family",
      "Fear of surgery but nothing else seems to be working"
    ],
    desiredOutcome: "Understand exactly what's wrong, have a clear plan to fix it, and get back to normal life without surgery.",
    oneSentenceDifference: "We help people with disc problems understand exactly what's happening in their spine and correct it structurally — so the disc can heal and the pain stops for good.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for helping people with disc problems heal without surgery.",
    pillarPhrases: [
      "A disc diagnosis isn't a life sentence. It's a starting point.",
      "We correct the structure so the disc can heal.",
      "Your MRI shows what happened. We figure out why — and fix it."
    ],
    tableTalkOneLiners: [
      "I had a herniated disc. They actually fixed it without surgery.",
      "They explained my MRI in a way that finally made sense.",
      "I was terrified when I got my diagnosis. They gave me a real plan.",
      "My disc is healing. I didn't know that was possible without surgery.",
      "They didn't just manage my pain. They're correcting the problem."
    ],
    patientStory: "They came in with an MRI showing a large L4-L5 disc herniation. They could barely stand up straight and hadn't slept in weeks. We identified the structural shifts loading that disc abnormally, built a corrective plan, and within 10 weeks they were back at work full-time. Follow-up imaging showed the herniation had reduced significantly.",
    referralTriggerLine: "If you know someone who just got told they have a disc problem and they're scared — send them in. We help people with disc issues heal without surgery every week.",
    easyIntroLine: "Go see Dr. ______. They fix disc problems. I had a herniation and they got me back to normal.",
    communityLane: "Employers & workplace wellness",
    socialPostTemplates: [
      "You got an MRI. It says \"disc bulge\" or \"herniation.\"\n\nYou're scared. That's normal.\n\nBut here's what nobody told you: discs CAN heal. The body is designed to repair — IF the structural cause of the damage is corrected.\n\nThat's what we do. We find why that disc failed and we fix it.\n\n#DiscHerniation #SpineHealth #CorrectiveCare",
      "A disc bulge is not a death sentence for your spine.\n\nIt's your body telling you something structural isn't right.\n\nWe find it. We correct it. The disc heals.\n\nIf you've been diagnosed and don't know what to do next — let's talk.",
      "\"But my MRI says...\"\n\nYour MRI shows WHAT happened.\nWe figure out WHY it happened.\nThen we fix it.\n\nThat's the difference between managing a disc problem and actually correcting it.\n\nLink in bio to learn more."
    ],
    videoTopics: [
      "What your disc MRI actually means (in plain English)",
      "Can a herniated disc heal without surgery? Here's what the research says.",
      "The 3 questions to ask before agreeing to disc surgery"
    ],
    imagePromptTemplates: [
      "Doctor reviewing spinal MRI images on a screen with a patient, explaining findings clearly, modern clinic",
      "Educational diagram showing disc herniation and structural correction, clean medical illustration style",
      "Patient standing tall and pain-free, before/after posture improvement, professional photography"
    ],
    photoSuggestions: [
      "You reviewing an MRI or X-ray on your screen (no patient info visible)",
      "A spine model showing a disc bulge — you pointing to it",
      "Your treatment room with corrective care equipment visible"
    ]
  },
  {
    id: "neck_pain",
    label: "Neck Pain & Stiffness",
    shortLabel: "Neck Pain",
    description: "People with chronic neck pain, stiffness, and limited mobility — often from desk work or tech use.",
    idealPatient: "Working professionals 30-55 with chronic neck pain and stiffness from desk work, phone use, or stress. They've tried massage, stretching, and OTC meds but it keeps coming back.",
    topProblems: [
      "Constant neck tightness and stiffness that never fully goes away",
      "Pain that radiates into shoulders or causes headaches",
      "Loss of mobility — can't turn their head fully"
    ],
    desiredOutcome: "Move their neck freely without pain, stop the headaches, and not have to think about their neck every single day.",
    oneSentenceDifference: "We help people with chronic neck pain find the structural problem causing it and correct it — so the stiffness stops coming back and the headaches go away.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for fixing chronic neck problems that massage and stretching can't touch.",
    pillarPhrases: [
      "If it keeps coming back, the cause hasn't been fixed.",
      "Your neck shouldn't hurt every day. That's not normal — it's a sign.",
      "We fix the structure. The muscles follow."
    ],
    tableTalkOneLiners: [
      "I can actually turn my head again. I forgot what that felt like.",
      "My headaches are gone. Turns out it was my neck the whole time.",
      "They found something in my neck that nobody else even looked for.",
      "I used to get a massage every week. Now I don't need to.",
      "They fixed the problem. Not just the symptom."
    ],
    patientStory: "They came in with 5 years of daily neck pain and weekly headaches. They'd spent thousands on massage and were taking ibuprofen daily. We found a significant loss of the normal cervical curve — their neck was essentially straight. After 12 weeks of corrective care, their curve improved, the daily pain stopped, and the headaches went from weekly to gone.",
    referralTriggerLine: "If you know someone whose neck hurts every day and nothing seems to fix it permanently — send them in. We find the structural cause and correct it.",
    easyIntroLine: "Go see Dr. ______. They fixed my neck when nothing else worked. The headaches are gone too.",
    communityLane: "Employers & workplace wellness",
    socialPostTemplates: [
      "Your neck shouldn't hurt every day.\n\nIf it does, something structural hasn't been addressed.\n\nMassage helps the muscles. Stretching helps the muscles. But if the STRUCTURE is off, the muscles will keep tightening up.\n\nWe fix the structure. The muscles follow.\n\n#NeckPain #CorrectiveCare #ChiropracticCare",
      "\"I just carry my stress in my neck.\"\n\nMaybe. Or maybe your neck has lost its normal curve and your muscles are working overtime to hold your head up.\n\nWe check. We measure. We fix what's actually wrong.\n\nDM me if your neck pain won't quit.",
      "Chronic neck pain checklist:\n\n□ Tried massage (helps temporarily)\n□ Tried stretching (helps temporarily)\n□ Tried meds (masks it)\n□ Still hurts every day\n\nIf you checked all 4 — nobody has fixed the structural cause yet.\n\nThat's what we do. Link in bio."
    ],
    videoTopics: [
      "Why massage won't fix your neck pain (and what will)",
      "The hidden cause of chronic neck stiffness nobody checks",
      "How your phone is changing your spine (and what to do about it)"
    ],
    imagePromptTemplates: [
      "Chiropractor examining a patient's cervical spine, professional clinical setting, focused and caring",
      "Side-by-side comparison of normal vs forward head posture, clean educational illustration",
      "Professional at a desk with good posture, bright modern office, health and wellness"
    ],
    photoSuggestions: [
      "You examining a patient's neck (side view shows your focus)",
      "A posture comparison — forward head vs corrected (use a model or yourself)",
      "Your cervical adjustment technique in action"
    ]
  },
  {
    id: "radiculopathy",
    label: "Radiculopathy & Arm Pain",
    shortLabel: "Arm/Nerve Pain",
    description: "People with numbness, tingling, or pain radiating into their arm or hand from a cervical nerve issue.",
    idealPatient: "Adults with arm pain, numbness, tingling, or weakness caused by cervical nerve compression. Often misdiagnosed as carpal tunnel or told they need neck surgery.",
    topProblems: [
      "Numbness or tingling in the arm, hand, or fingers",
      "Pain that shoots from the neck down the arm",
      "Weakness or dropping things — scared it's permanent"
    ],
    desiredOutcome: "Get feeling back in their arm/hand, stop the pain, and know the nerve is actually healing — not just being numbed.",
    oneSentenceDifference: "We help people with arm numbness and nerve pain find exactly where the nerve is being compressed and correct it — so feeling and strength come back without surgery.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for fixing nerve problems in the neck that cause arm pain and numbness.",
    pillarPhrases: [
      "Numbness is a signal. Something is pressing on a nerve.",
      "We find the pressure. We remove it. The nerve heals.",
      "Don't wait until the damage is permanent."
    ],
    tableTalkOneLiners: [
      "I can feel my fingers again. I thought I'd lost that for good.",
      "They found exactly where my nerve was being pinched.",
      "I was told I needed neck surgery. They fixed it without cutting.",
      "The tingling in my arm is gone. It took weeks, not months.",
      "They didn't just treat my arm. They fixed my neck — that's where the problem was."
    ],
    patientStory: "They came in with 6 months of progressive numbness in their right hand and shooting pain down their arm. They'd been diagnosed with carpal tunnel and were scheduled for wrist surgery. We found a cervical disc issue compressing the C6 nerve root. After corrective care, the numbness resolved completely. They cancelled the wrist surgery because the problem was never in their wrist.",
    referralTriggerLine: "If you know someone with arm numbness or tingling and they're not getting answers — send them in. We find where the nerve is being compressed and fix it.",
    easyIntroLine: "Go see Dr. ______. I had numbness in my hand for months. They found it was coming from my neck and fixed it.",
    communityLane: "Employers & workplace wellness",
    socialPostTemplates: [
      "Numbness in your arm or hand?\n\nBefore you assume it's carpal tunnel, ask: has anyone checked your NECK?\n\nThe nerves that control your arm, hand, and fingers all come from your cervical spine. If something is pressing on them there — no amount of wrist braces will help.\n\nWe find it. We fix it.\n\n#NervePain #Radiculopathy #CorrectiveCare",
      "\"They said it was carpal tunnel.\"\n\nWe checked the neck. Found a disc pressing on the nerve root.\n\nFixed the neck. Hand numbness gone. Wrist surgery cancelled.\n\nNot every case is this clear. But every case deserves a proper look.\n\nDM me if you're dealing with arm or hand numbness.",
      "If you're losing feeling in your hand or arm — don't ignore it.\n\nNerves can heal. But they need the pressure removed.\n\nThe longer you wait, the harder it is to reverse.\n\nWe specialize in finding nerve compression and correcting it. Link in bio."
    ],
    videoTopics: [
      "Is it really carpal tunnel? The neck test most doctors skip.",
      "Why arm numbness is a warning sign you shouldn't ignore",
      "How we find and fix cervical nerve compression without surgery"
    ],
    imagePromptTemplates: [
      "Chiropractor performing a cervical nerve test on a patient's arm, clinical setting, diagnostic focus",
      "Educational illustration of cervical nerve pathways to the arm and hand, clean medical style",
      "Patient gripping strongly with recovered hand strength, positive outcome, bright setting"
    ],
    photoSuggestions: [
      "You performing a nerve tension test on a patient's arm",
      "A cervical spine model showing nerve roots",
      "Close-up of your hands doing a cervical examination"
    ]
  },
  {
    id: "shoulder_pain",
    label: "Shoulder Pain",
    shortLabel: "Shoulder",
    description: "People with chronic shoulder pain, frozen shoulder, or rotator cuff issues that aren't responding to PT alone.",
    idealPatient: "Active adults 40-65 with shoulder pain that limits their daily life — can't reach overhead, sleep on that side, or exercise. PT helped some but didn't solve it.",
    topProblems: [
      "Shoulder pain that limits reaching, lifting, or sleeping",
      "Frozen shoulder or progressive loss of motion",
      "Rotator cuff issues that PT alone can't resolve"
    ],
    desiredOutcome: "Use their shoulder normally again — reach overhead, sleep on their side, exercise without fear of making it worse.",
    oneSentenceDifference: "We help people with stubborn shoulder problems find the structural cause — often in the spine and rib cage — and correct it so the shoulder can actually heal.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for fixing shoulder problems that PT alone can't solve.",
    pillarPhrases: [
      "Your shoulder might not be the problem. It might be where the problem shows up.",
      "We look at the whole chain — spine, ribs, shoulder.",
      "Fix the foundation. The shoulder follows."
    ],
    tableTalkOneLiners: [
      "I can reach overhead again. I couldn't do that for a year.",
      "They found the problem wasn't actually my shoulder — it was my upper back.",
      "I can sleep on my side again. That alone changed my life.",
      "PT helped but it kept coming back. They fixed what PT couldn't.",
      "They looked at my whole spine, not just my shoulder. That made the difference."
    ],
    patientStory: "They came in with 14 months of shoulder pain. They'd done 6 months of PT with minimal improvement and were considering surgery. We found significant upper thoracic and rib dysfunction that was altering their shoulder mechanics. After correcting the spinal foundation, their shoulder mobility returned fully within 8 weeks and the pain resolved.",
    referralTriggerLine: "If you know someone with a shoulder problem that PT hasn't been able to fix — send them in. We look at what's underneath it.",
    easyIntroLine: "Go see Dr. ______. My shoulder was stuck for over a year. They found the real problem and fixed it.",
    communityLane: "Gyms & fitness communities",
    socialPostTemplates: [
      "Shoulder pain that won't go away?\n\nHere's what most people miss: the shoulder is only as good as the foundation it sits on.\n\nIf your upper back, ribs, or cervical spine are off — your shoulder will keep failing no matter how much PT you do.\n\nWe fix the foundation. The shoulder follows.\n\n#ShoulderPain #CorrectiveCare #Chiropractic",
      "\"PT helped for a while but it keeps coming back.\"\n\nThat's because PT strengthens the muscles around the problem.\n\nBut if the structural foundation is off, those muscles are fighting a losing battle.\n\nWe find the structural cause. We correct it. Then the shoulder can actually heal.\n\nDM me if this sounds familiar.",
      "Your shoulder problem might not be a shoulder problem.\n\nIt might be:\n- A rib that's not moving right\n- A thoracic spine that's locked up\n- A cervical nerve that's not firing properly\n\nWe check all of it. That's why we get results when other approaches stall.\n\nLink in bio."
    ],
    videoTopics: [
      "Why your shoulder pain might actually be a spine problem",
      "The rib connection to frozen shoulder nobody talks about",
      "What to do when PT isn't fixing your shoulder"
    ],
    imagePromptTemplates: [
      "Chiropractor examining a patient's shoulder and upper back connection, professional clinical setting",
      "Educational illustration showing thoracic spine and rib relationship to shoulder mechanics",
      "Patient reaching overhead freely, active lifestyle, recovery success"
    ],
    photoSuggestions: [
      "You examining a patient's shoulder with attention to the upper back",
      "A patient demonstrating improved range of motion (with permission)",
      "You adjusting the thoracic spine or ribs"
    ]
  },
  {
    id: "headaches",
    label: "Headaches & Migraines",
    shortLabel: "Headaches",
    description: "People with chronic headaches or migraines who are tired of taking medication and want to find the cause.",
    idealPatient: "Adults with frequent headaches or migraines who take medication regularly and want to stop. They know the pills aren't fixing anything — they want to know WHY they keep getting headaches.",
    topProblems: [
      "Headaches multiple times per week that medication only masks",
      "Migraines that steal entire days from their life",
      "Being told 'it's just stress' with no real solution"
    ],
    desiredOutcome: "Live without the constant threat of a headache — no more planning around pain, no more medication dependency.",
    oneSentenceDifference: "We help people with chronic headaches find the structural cause in their neck and correct it — so the headaches stop happening instead of just being medicated.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for eliminating chronic headaches by fixing what's causing them in the neck.",
    pillarPhrases: [
      "Headaches have a cause. Medication hides it. We find it.",
      "Your neck controls the blood flow and nerve supply to your head.",
      "Stop managing headaches. Start fixing them."
    ],
    tableTalkOneLiners: [
      "I used to get headaches 4 days a week. Now I can't remember my last one.",
      "They found something in my neck that was causing all my headaches.",
      "I haven't taken Excedrin in 3 months. That's never happened.",
      "They didn't give me more pills. They fixed why I was getting headaches.",
      "My migraines are gone. I got my weekends back."
    ],
    patientStory: "They came in taking ibuprofen daily for headaches that had been getting worse for 3 years. Their doctor said it was stress and prescribed a muscle relaxer. We found a significant loss of cervical curve and upper cervical misalignment affecting nerve and blood flow to the head. After 10 weeks of corrective care, their headaches went from 4-5 per week to zero. They haven't taken a headache pill in 2 months.",
    referralTriggerLine: "If you know someone who gets headaches all the time and they're just taking pills — send them in. We find what's causing them and fix it.",
    easyIntroLine: "Go see Dr. ______. They got rid of my headaches. Turns out it was my neck the whole time.",
    communityLane: "Employers & workplace wellness",
    socialPostTemplates: [
      "Taking Tylenol for headaches is like putting tape over the check engine light.\n\nThe light goes off. The problem doesn't.\n\nMost chronic headaches have a structural cause in the neck. Fix the neck, the headaches stop.\n\nWe find it. We fix it.\n\n#Headaches #Migraines #CorrectiveCare #ChiropracticCare",
      "\"I've always been a headache person.\"\n\nNo you haven't. Something changed. Something structural shifted in your neck and now your head pays the price.\n\nYou don't have to live like this.\n\nDM me if headaches are running your life.",
      "If you get headaches more than once a week, ask yourself:\n\nHas anyone actually checked your NECK?\n\nNot just felt for tight muscles. Actually measured the structure.\n\nBecause that's where most chronic headaches start — and that's where we fix them.\n\nLink in bio."
    ],
    videoTopics: [
      "The neck-headache connection most doctors never check",
      "Why medication will never fix your headaches (and what will)",
      "3 signs your headaches are coming from your cervical spine"
    ],
    imagePromptTemplates: [
      "Chiropractor examining upper cervical spine of a patient, focused diagnostic approach, professional clinic",
      "Person holding their head in pain vs same person smiling and active, before/after concept",
      "Educational illustration of cervical spine and blood/nerve supply to the head"
    ],
    photoSuggestions: [
      "You performing an upper cervical examination",
      "A cervical X-ray or posture scan on your screen (no patient info)",
      "You explaining the neck-headache connection using a spine model"
    ]
  },
  {
    id: "general_corrective",
    label: "General Corrective Care",
    shortLabel: "Corrective",
    description: "For doctors who want to position broadly as corrective/structural chiropractors — not condition-specific.",
    idealPatient: "Anyone who's been told their pain is 'normal,' who's tired of temporary fixes, and who wants to actually find and correct the underlying structural problem.",
    topProblems: [
      "Chronic pain that keeps coming back no matter what they try",
      "Being told 'it's just your age' or 'learn to live with it'",
      "Spending money on treatments that only help temporarily"
    ],
    desiredOutcome: "Know exactly what's wrong, have a clear plan to fix it, and get back to living without constantly managing pain.",
    oneSentenceDifference: "We help people who are tired of temporary fixes find the real structural problem and correct it — so they actually get better instead of just feeling better for a week.",
    localPosition: "The Fixer",
    knownForSentence: "I want to be the go-to chiropractor known for finding and fixing problems that nobody else has been able to solve.",
    pillarPhrases: [
      "We find it. We fix it. You get your life back.",
      "Temporary relief isn't the goal. Correction is.",
      "If nobody's found the real problem yet — that's exactly why we're here."
    ],
    tableTalkOneLiners: [
      "They actually found what was wrong. Nobody else could.",
      "They don't just make you feel better for a day. They fix the problem.",
      "I've been to 5 other places. They're the ones who figured it out.",
      "They showed me exactly what was wrong and had a plan to correct it.",
      "I'm not just managing anymore. I'm actually getting better."
    ],
    patientStory: "They came in after years of bouncing between providers — massage, PT, other chiropractors, pain management. Everyone helped temporarily but nothing stuck. We found a significant structural problem that nobody had identified or addressed. After a focused corrective plan, their chronic pain resolved and they got their active life back.",
    referralTriggerLine: "If you know someone who's tried everything and nothing has worked long-term — send them in. Finding the real problem is what we do.",
    easyIntroLine: "Go see Dr. ______. They find what's actually wrong and fix it. I tried everything else first.",
    communityLane: "Gyms & fitness communities",
    socialPostTemplates: [
      "If you've tried everything and nothing has worked long-term — nobody has found the real problem yet.\n\nThat's not your fault. That's a diagnostic gap.\n\nWe find it. We fix it. You get your life back.\n\n#CorrectiveCare #Chiropractic #SpineHealth",
      "The difference between relief and correction:\n\nRelief = feels better today, hurts again next week\nCorrection = find the cause, fix it, it stays fixed\n\nWhich one are you getting?\n\nIf you're tired of the cycle — we should talk.\n\nDM me or link in bio.",
      "\"I've been told to just live with it.\"\n\nThat's not a diagnosis. That's giving up.\n\nYou came to this planet to live fully — not to manage pain.\n\nWe find structural problems other providers miss. And we fix them.\n\nLink in bio if you're ready for a different approach."
    ],
    videoTopics: [
      "The difference between pain relief and structural correction",
      "Why your problem keeps coming back (and what nobody's checking)",
      "What corrective chiropractic actually means (in plain English)"
    ],
    imagePromptTemplates: [
      "Confident chiropractor in a modern clinic, professional and approachable, corrective care environment",
      "Before and after posture/structural comparison, clean clinical photography",
      "Doctor and patient reviewing progress together, collaborative healthcare, warm lighting"
    ],
    photoSuggestions: [
      "You in your clinic looking confident and professional",
      "Your examination or adjustment in action",
      "A patient progress comparison (posture, range of motion — with permission)"
    ]
  }
];

export function getTopicById(id: string): QuickStartTopic | undefined {
  return QUICK_START_TOPICS.find(t => t.id === id);
}

export function getTopicLabels(): Array<{ id: string; label: string; shortLabel: string; description: string }> {
  return QUICK_START_TOPICS.map(t => ({ id: t.id, label: t.label, shortLabel: t.shortLabel, description: t.description }));
}
