import type { AIAnalysis, Severity } from "../types";
import { ENV } from "../constants/env";

const TRIAGE_PROMPT = `
You are MediLink AI Triage Agent.

Your job is emergency triage, multilingual symptom understanding, injury image analysis, and safe first-response guidance.

You are NOT a doctor. You do not provide a final diagnosis. You do not prescribe medicines directly to patients.
Medicine suggestions are ONLY for doctor review and must be clearly marked as "doctorReviewMedicines".

========================
LANGUAGE UNDERSTANDING
========================
Users may write in:
- English
- Urdu script
- Roman Urdu
- Pashto script
- Roman Pashto
- Mixed Urdu + English

You must understand natural, messy, non-medical language.

Examples:
- "mere hath se khoon nikal raha hai" = bleeding from my hand
- "mera sar bohat dard kar raha hai" = severe headache
- "saans nahi aa rahi" = difficulty breathing
- "seeny me dard hai" = chest pain
- "zakhm ho gaya hai" = wound/cut
- "چوٹ لگ گئی ہے" = injury
- "خون بہہ رہا ہے" = bleeding
- "ساه نه راځي" = difficulty breathing
- "زما سر ډیر درد کوي" = my head hurts badly

Always detect the user's language and respond in the same language style:
- Roman Urdu input => Roman Urdu response
- Urdu script input => Urdu script response
- Pashto input => Pashto response
- English input => English response
- Mixed input => simple mixed response

========================
NORMALIZATION STEP
========================
Before triage, silently normalize the user input into clinical English.
Use this normalized meaning to classify severity.
Do NOT require exact medical words.
Infer meaning from common local phrases.

========================
IMAGE ANALYSIS
========================
If an image is provided, analyze visible signs only:
- bleeding
- wound depth
- swelling
- burn
- deformity
- rash
- skin color changes
- possible infection signs
- visible danger signs

Never claim certainty from image alone.
Use phrases like:
- "visible signs suggest..."
- "the image appears to show..."
- "this may need medical review..."

========================
SEVERITY RULES
========================
CRITICAL if:
- chest pain with sweating, breathlessness, fainting
- severe breathing difficulty
- unconsciousness, seizure, stroke signs
- heavy uncontrolled bleeding
- deep wound with active bleeding
- severe burn, face/neck burn, large burn
- major accident
- head injury with vomiting/confusion
- poisoning
- severe allergic reaction or throat swelling

HIGH if:
- deep cut but bleeding controlled
- suspected fracture/deformity
- high fever with weakness/confusion
- moderate breathing problem
- infected wound signs
- severe pain after trauma

MEDIUM if:
- fever/cough without red flags
- vomiting/diarrhea but awake and drinking
- moderate headache without red flags
- minor burn
- mild allergic rash without breathing issue

LOW if:
- minor discomfort
- mild headache
- small scratch
- non-medical/joke/test

========================
PATIENT SAFETY
========================
For patient-facing advice:
- Give immediate first-aid steps.
- Keep language calm and human.
- Tell when to call emergency services.
- Do NOT tell patient to start antibiotics, injections, opioids, heart medicines, or prescription-only drugs.
- For simple OTC medicine, only mention general safe options when appropriate, such as paracetamol for fever/pain, with a safety warning to follow label/local doctor advice.
- Always warn about allergies, pregnancy, children, elderly, chronic illness, blood thinners, kidney/liver disease when relevant.

========================
DOCTOR MEDICINE REVIEW
========================
doctorReviewMedicines may include possible medicines for clinician review only.
Every item must start with:
"FOR DOCTOR REVIEW ONLY —"

Do not present these as instructions for the patient.
Avoid aggressive emergency drug instructions unless the case is clearly critical, and still mark for doctor/EMS review.

Medicine format:
FOR DOCTOR REVIEW ONLY — Chemical Name (Brand Name) — strength/form if relevant — route — purpose — key caution

========================
JOKE / TEST / UNCLEAR
========================
If joke/test/non-medical:
- triageLevel low
- confidence high
- no medicines
- friendly response

If unclear:
- ask 2-4 short questions
- give safe general advice
- triageLevel low or medium depending on risk

========================
OUTPUT
========================
Respond ONLY with valid JSON.

Schema:
{
  "detectedLanguage": "english|urdu|roman_urdu|pashto|roman_pashto|mixed|unknown",
  "normalizedInputEnglish": "short English meaning of the user's input",
  "possibleConditions": ["not final diagnoses"],
  "recommendedFirstAid": ["safe immediate steps for the patient"],
  "doctorReviewMedicines": ["FOR DOCTOR REVIEW ONLY — ..."],
  "situationalSuggestions": ["practical next steps"],
  "redFlags": ["danger signs to watch for"],
  "safetyWarnings": ["allergy/chronic disease/pregnancy/child warnings"],
  "triageLevel": "critical|high|medium|low",
  "confidence": 0.0,
  "patientMessage": "warm patient-facing response in the user's same language",
  "doctorSummary": "concise clinical-style summary in English for dashboard",
  "summary": "same as patientMessage or concise case summary",
  "requiresImmediate": true
}

Patient history:
- Check allergies, chronic disease, previous medicines, age, pregnancy status if provided.
- If no history is available, include: "Medical history/allergies unknown — verify before medication."
`;

function normalizeLocalMedicalText(text: string): string {
  const s = String(text || "").toLowerCase();
  const patterns: Record<string, string[]> = {
    wound: ["cut", "wound", "bleed", "bleeding", "blood", "injury", "laceration", "stab", "slash", "zakhm", "zakham", "zakhmi", "khoon", "chot", "زخم", "خون", "چوٹ", "ټپ", "وینه"],
    cardiac: ["chest pain", "heart pain", "cardiac", "palpitation", "seeny me dard", "sina dard", "dil dard", "دل", "سینہ", "سينه", "زړه"],
    breathing: ["breath", "breathing", "asthma", "wheezing", "choking", "lung", "saans", "sans", "dam ghut", "سانس", "ساه", "دم"],
    fracture: ["fracture", "broken", "bone", "fall", "sprain", "deformity", "haddi", "hadi toot", "gir gaya", "ہڈی", "ٹوٹی", "مات", "هډوکی"],
    fever: ["fever", "temperature", "flu", "cough", "cold", "bukhar", "tap", "بخار", "کھانسی", "تبه", "ټوخی"],
    headache: ["headache", "migraine", "sar dard", "sir dard", "سر درد", "سر", "سر خوږ"],
    stomach: ["stomach", "vomit", "nausea", "diarrhea", "pait", "pet", "ulti", "qay", "پیٹ", "الٹی", "دست", "کانګې", "نس ناستی"],
    burns: ["burn", "fire", "scald", "jal gaya", "aag", "جل گیا", "آگ", "سوځېدلی", "اور"],
    allergy: ["allergy", "rash", "itch", "swelling", "hives", "khujli", "soojan", "الرجی", "خارش", "سوجن", "پړسوب", "خارښت"],
  };

  const matched: string[] = [];
  for (const [label, words] of Object.entries(patterns)) {
    if (words.some((w) => s.includes(w))) {
      matched.push(label);
    }
  }
  return `${text || ""}\n\n[normalized_keywords]: ${matched.join(", ") || "none"}`;
}

const FALLBACKS: Record<string, AIAnalysis> = {
  wound: {
    detectedLanguage: "unknown",
    normalizedInputEnglish: "Possible wound or bleeding injury",
    possibleConditions: ["Possible wound/laceration", "Bleeding risk", "Infection risk"],
    recommendedFirstAid: [
      "Apply firm direct pressure with a clean cloth or sterile gauze.",
      "If possible, raise the injured area above heart level.",
      "Rinse minor dirt with clean running water. Do not scrub a deep wound.",
      "Cover with a clean dressing.",
      "Seek urgent medical care if bleeding does not stop, wound is deep, or edges are wide open.",
    ],
    doctorReviewMedicines: [
      "FOR DOCTOR REVIEW ONLY — Tetanus toxoid — vaccine/booster if indicated — IM — tetanus prevention — verify vaccination history.",
      "FOR DOCTOR REVIEW ONLY — Amoxicillin + Clavulanic Acid (Augmentin) — oral antibiotic — oral — infection prevention/treatment if clinically indicated — check allergy history.",
    ],
    situationalSuggestions: ["Do not apply toothpaste, powders, or dirty remedies.", "Seek immediate emergency help if bleeding continues."],
    recommendedActions: ["Apply firm pressure", "Elevate wound", "Clean water rinse"],
    redFlags: ["Uncontrolled bleeding", "Numbness or loss of movement", "Contaminated/dirty cut"],
    safetyWarnings: ["Medical history/allergies unknown — verify before medication."],
    triageLevel: "high",
    confidence: 0.75,
    patientMessage: "Apply firm pressure with a clean cloth and raise the wound if possible. If bleeding is heavy or does not stop, get emergency medical care immediately.",
    doctorSummary: "Possible bleeding wound. Assess closure, tetanus status, and neurovascular state.",
    summary: "Possible wound or bleeding injury.",
    requiresImmediate: true,
  },
  cardiac: {
    detectedLanguage: "unknown",
    normalizedInputEnglish: "Possible chest pain or cardiac emergency",
    possibleConditions: ["Possible acute coronary syndrome", "Chest pain requiring urgent evaluation"],
    recommendedFirstAid: [
      "Call emergency services immediately.",
      "Keep the patient sitting upright and resting.",
      "Loosen tight clothing.",
      "Do not let the patient walk or drive themselves.",
    ],
    doctorReviewMedicines: [
      "FOR DOCTOR REVIEW ONLY — Aspirin — antiplatelet — oral/chewable — suspected ACS support — avoid if allergy or active bleeding.",
    ],
    situationalSuggestions: ["Call EMS immediately", "Keep sitting, avoid physical activity"],
    recommendedActions: ["Call emergency services now", "Keep resting in sitting position", "Loosen tight clothes"],
    redFlags: ["Chest pain spreading to left arm/jaw", "Pain with sweating, breathing difficulty, or fainting"],
    safetyWarnings: ["Emergency medical evaluation required immediately. Do not delay."],
    triageLevel: "critical",
    confidence: 0.85,
    patientMessage: "This chest pain might be serious. Please sit upright, stay calm, and call emergency services immediately.",
    doctorSummary: "Chest pain/ACS symptoms. Immediate ECG and vital monitoring required.",
    summary: "Possible cardiac emergency.",
    requiresImmediate: true,
  },
  general: {
    detectedLanguage: "unknown",
    normalizedInputEnglish: "Unclear or insufficient symptoms",
    possibleConditions: ["Unclear symptoms"],
    recommendedFirstAid: ["Provide more details about pain location, duration, and details."],
    doctorReviewMedicines: [],
    situationalSuggestions: ["Monitor details and share symptoms if they change."],
    recommendedActions: ["Provide more details"],
    redFlags: ["Any severe chest pain, extreme breathlessness, or heavy bleeding"],
    safetyWarnings: ["Medical history unknown."],
    triageLevel: "low",
    confidence: 0.25,
    patientMessage: "Please share more details about your symptoms so I can assist. If you have chest pain, extreme breathlessness, or heavy bleeding, call emergency services immediately.",
    doctorSummary: "Unclear symptoms reported. Monitor and request details.",
    summary: "Unclear symptoms.",
    requiresImmediate: false,
  },
};

function matchFallback(text: string): AIAnalysis {
  const s = text.toLowerCase();
  if (/wound|bleed|blood|injury|zakhm|zakham|khoon|chot|زخم|خون|چوٹ|ټپ|وینه/.test(s)) {
    return FALLBACKS.wound;
  }
  if (/cardiac|chest|heart|seeny|seene|sina|dil|دل|سینہ|سينه|زړه/.test(s)) {
    return FALLBACKS.cardiac;
  }
  return FALLBACKS.general;
}

function parseAIResponse(text: string): AIAnalysis {
  let jsonStr = String(text || "").trim();
  const blockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (blockMatch) {
    jsonStr = blockMatch[1].trim();
  } else {
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    const p = JSON.parse(jsonStr);
    const rawTriage = String(p.triageLevel || "").toLowerCase().trim();
    const finalTriage: Severity = ["critical", "high", "medium", "low"].includes(rawTriage)
      ? (rawTriage as Severity)
      : "medium";

    const requiresImmediate =
      p.requiresImmediate === true ||
      String(p.requiresImmediate).toLowerCase() === "true" ||
      finalTriage === "critical";

    const patientMessage = p.patientMessage || p.summary || "Analysis complete.";
    const doctorSummary = p.doctorSummary || p.normalizedInputEnglish || "Clinical summary unavailable.";

    return {
      detectedLanguage: String(p.detectedLanguage || "unknown"),
      normalizedInputEnglish: String(p.normalizedInputEnglish || ""),
      possibleConditions: Array.isArray(p.possibleConditions) ? p.possibleConditions.map(String) : [],
      recommendedFirstAid: Array.isArray(p.recommendedFirstAid) ? p.recommendedFirstAid.map(String) : [],
      doctorReviewMedicines: Array.isArray(p.doctorReviewMedicines) ? p.doctorReviewMedicines.map(String) : [],
      situationalSuggestions: Array.isArray(p.situationalSuggestions) ? p.situationalSuggestions.map(String) : [],
      recommendedActions: [
        ...(Array.isArray(p.doctorReviewMedicines) ? p.doctorReviewMedicines : []),
        ...(Array.isArray(p.recommendedFirstAid) ? p.recommendedFirstAid : []),
      ],
      redFlags: Array.isArray(p.redFlags) ? p.redFlags.map(String) : [],
      safetyWarnings: Array.isArray(p.safetyWarnings) ? p.safetyWarnings.map(String) : [],
      triageLevel: finalTriage,
      confidence: Math.min(1, Math.max(0, Number(p.confidence) || 0.5)),
      patientMessage,
      doctorSummary,
      summary: String(p.summary || patientMessage),
      requiresImmediate,
    };
  } catch (err) {
    console.warn("Failed to parse AI JSON, returning fallback:", err);
    return matchFallback(text);
  }
}

async function analyzeWithGemini(params: {
  symptoms: string;
  description: string;
  patientHistory?: string;
  imageBase64?: string;
  apiKey: string;
  modelName: string;
}): Promise<AIAnalysis> {
  const { symptoms, description, patientHistory, imageBase64, apiKey, modelName } = params;
  const normalizedSymptoms = normalizeLocalMedicalText(symptoms);
  const normalizedDescription = normalizeLocalMedicalText(description);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const textPart = {
    text: `${TRIAGE_PROMPT}

[PATIENT HISTORY]:
${patientHistory || "No historical records provided."}

[CURRENT CASE RAW]:
Symptoms: ${symptoms || ""}
Details: ${description || ""}

[CURRENT CASE NORMALIZED HINTS]:
Symptoms:
${normalizedSymptoms}

Details:
${normalizedDescription}
`,
  };

  const parts: any[] = [textPart];

  if (imageBase64) {
    let cleanImage = imageBase64;
    if (imageBase64.startsWith("data:image")) {
      const splitParts = imageBase64.split(",");
      cleanImage = splitParts[1] || imageBase64;
    }
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanImage,
      },
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini response is empty.");
  return parseAIResponse(text);
}

async function analyzeWithOpenAI(params: {
  symptoms: string;
  description: string;
  patientHistory?: string;
  imageBase64?: string;
  apiKey: string;
}): Promise<AIAnalysis> {
  const { symptoms, description, patientHistory, imageBase64, apiKey } = params;
  const normalizedSymptoms = normalizeLocalMedicalText(symptoms);
  const normalizedDescription = normalizeLocalMedicalText(description);

  const caseText = `
[PATIENT HISTORY]:
${patientHistory || "No historical records provided."}

[CURRENT CASE RAW]:
Symptoms: ${symptoms || ""}
Details: ${description || ""}

[CURRENT CASE NORMALIZED HINTS]:
Symptoms:
${normalizedSymptoms}

Details:
${normalizedDescription}
`;

  let userContent: any = caseText;
  if (imageBase64) {
    let cleanImage = imageBase64;
    if (imageBase64.startsWith("data:image")) {
      const splitParts = imageBase64.split(",");
      cleanImage = splitParts[1] || imageBase64;
    }
    userContent = [
      { type: "text", text: caseText },
      {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${cleanImage}` },
      },
    ];
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: imageBase64 ? "gpt-4o" : "gpt-4o-mini",
      messages: [
        { role: "system", content: TRIAGE_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI response is empty.");
  return parseAIResponse(text);
}

export async function analyzeSymptoms(
  symptoms: string,
  description: string,
  patientHistory?: string,
  imageBase64?: string
): Promise<AIAnalysis> {
  const combinedText = `${symptoms} ${description}`.trim();

  // 1. Try Primary Gemini Key (gemini-2.5-flash)
  if (ENV.GEMINI_API_KEY) {
    try {
      console.log("[AI Triage Mobile] Calling Primary Gemini API...");
      return await analyzeWithGemini({
        symptoms,
        description,
        patientHistory,
        imageBase64,
        apiKey: ENV.GEMINI_API_KEY,
        modelName: "gemini-2.5-flash",
      });
    } catch (error) {
      console.warn("[AI Triage Mobile] Primary Gemini failed:", error);
    }
  }

  // 2. Try Fallback Gemini Key (gemini-2.5-flash)
  if (ENV.GEMINI_API_KEY_FALLBACK) {
    try {
      console.log("[AI Triage Mobile] Calling Fallback Gemini 2.5 API...");
      return await analyzeWithGemini({
        symptoms,
        description,
        patientHistory,
        imageBase64,
        apiKey: ENV.GEMINI_API_KEY_FALLBACK,
        modelName: "gemini-2.5-flash",
      });
    } catch (error) {
      console.warn("[AI Triage Mobile] Fallback Gemini 2.5 failed:", error);
    }
  }

  // 3. Try Fallback Gemini Key with Gemini 2 (gemini-2.0-flash)
  if (ENV.GEMINI_API_KEY_FALLBACK) {
    try {
      console.log("[AI Triage Mobile] Calling Fallback Gemini 2.0 API...");
      return await analyzeWithGemini({
        symptoms,
        description,
        patientHistory,
        imageBase64,
        apiKey: ENV.GEMINI_API_KEY_FALLBACK,
        modelName: "gemini-2.0-flash",
      });
    } catch (error) {
      console.warn("[AI Triage Mobile] Fallback Gemini 2.0 failed:", error);
    }
  }

  // 4. Try OpenAI Fallback
  if (ENV.OPENAI_API_KEY) {
    try {
      console.log("[AI Triage Mobile] Calling OpenAI API Triage...");
      return await analyzeWithOpenAI({
        symptoms,
        description,
        patientHistory,
        imageBase64,
        apiKey: ENV.OPENAI_API_KEY,
      });
    } catch (error) {
      console.warn("[AI Triage Mobile] OpenAI failed:", error);
    }
  }

  // 5. Hardcoded Local Rule Fallback
  console.log("[AI Triage Mobile] Using local keyword rules fallback...");
  return matchFallback(combinedText || "visual assessment");
}

export async function analyzeImage(imageBase64: string): Promise<string> {
  const result = await analyzeSymptoms(
    "Visual assessment",
    "Patient submitted an image for emergency triage. Analyze visible signs only.",
    undefined,
    imageBase64
  );
  return result.patientMessage || result.summary || result.doctorSummary || "Image analyzed.";
}
