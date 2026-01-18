import { GoogleGenAI, FunctionDeclaration, Type, SchemaType } from "@google/genai";
import { ToolCallArgs } from "../types";

// Define the tool for reporting safety violations
const reportViolationTool: FunctionDeclaration = {
  name: 'report_safety_violation',
  description: 'Report a safety violation or hazard detected in the video feed. Triggers an alert system.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      severity: {
        type: Type.STRING,
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'The severity level of the violation.',
      },
      message: {
        type: Type.STRING,
        description: 'A concise description of the violation (e.g., "Worker not wearing hard hat").',
      },
      location: {
        type: Type.STRING,
        description: 'The approximate location in the frame or zone (e.g., "Scaffolding Zone A").',
      },
      reasoning_steps: {
        type: Type.STRING,
        description: 'A detailed, step-by-step deduction trace explaining why this is a violation. Example: "1. Worker detected. 2. Height estimated > 6ft. 3. No harness visible."',
      },
    },
    required: ['severity', 'message', 'location', 'reasoning_steps'],
  },
};

const reportSafeStatusTool: FunctionDeclaration = {
  name: 'report_safe_status',
  description: 'Log a routine check when no violations are found.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      location: {
        type: Type.STRING,
        description: 'The area monitored.',
      },
      reasoning_steps: {
        type: Type.STRING,
        description: 'Step-by-step confirmation of safety protocols observed.',
      },
    },
    required: ['location', 'reasoning_steps'],
  },
};

// --- CONTEXTUAL GROUNDING: MOCK OSHA MANUAL ---
const OSHA_MANUAL_CONTEXT = `
OFFICIAL SAFETY STANDARDS MANUAL (OSHA 1910 GENERAL INDUSTRY EXCERPT)

SECTION 4: FALL PROTECTION
4.1 General Duty (29 CFR 1910.28):
   (a) The employer shall ensure that each employee on a walking-working surface with an unprotected side or edge that is 4 feet (1.2 m) or more above a lower level is protected from falling.
4.2 Scaffolding (29 CFR 1926.451):
   (a) Each employee on a scaffold more than 10 feet (3.1 m) above a lower level shall be protected from falling to that lower level.
   (b) Cross-braces must be installed.
   (c) Hard hats are required for all personnel on or below scaffolding.

SECTION 5: PERSONAL PROTECTIVE EQUIPMENT (PPE)
5.1 Head Protection (29 CFR 1910.135):
   (a) Employees working in areas where there is a potential for injury to the head from falling objects must wear protective helmets (Hard Hats).
5.2 High Visibility (General Duty Clause):
   (a) Employees working near heavy machinery or traffic must wear high-visibility safety vests (Yellow/Orange).
5.3 Eye Protection (29 CFR 1910.133):
   (a) Required when exposed to flying particles, liquid chemicals, acids or caustic liquids, chemical gases or vapors.

SECTION 6: CONTROL OF HAZARDOUS ENERGY
6.1 Exclusion Zones:
   (a) Personnel must maintain a 3-foot clearance from operating forklifts.
   (b) Yellow marked floor zones around automated arms are "No Entry" zones while active.
`;

let client: GoogleGenAI | null = null;

const getClient = () => {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return client;
};

export const analyzeFrame = async (base64Image: string): Promise<ToolCallArgs | null> => {
  const ai = getClient();
  const modelId = 'gemini-3-flash-preview'; 

  // Remove data URL prefix if present for the API call
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `*** ATTACHED DOCUMENT: SAFETY_MANUAL_V2.PDF (PARSED CONTENT) ***
${OSHA_MANUAL_CONTEXT}
*** END OF DOCUMENT ***`
          },
          {
            text: `You are an automated Industrial Safety Auditor (OSHA compliance bot).
            
            INSTRUCTIONS:
            Based strictly on the "Safety Manual" provided above (Context), analyze this video frame.
            
            1. OBSERVE: Identify workers, equipment, and environment.
            2. CROSS-REFERENCE: Compare observations against the specific Sections in the manual (e.g., Section 5.1 for Head Protection).
            3. DECIDE:
               - If a worker violates a specific rule, call 'report_safety_violation'.
               - You MUST cite the specific Section Number (e.g., "Violates Section 4.2(a)") in your reasoning steps.
               - If all observed personnel and conditions are compliant with the manual, call 'report_safe_status'.
            
            Use your "High Thinking" capability to reason through spatial relationships (distances, heights) and temporal context.
            `
          }
        ]
      },
      config: {
        tools: [{ functionDeclarations: [reportViolationTool, reportSafeStatusTool] }],
        thinkingConfig: { thinkingBudget: 2048 }, 
        temperature: 0.2, 
      }
    });

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) return null;

    const candidate = candidates[0];
    
    // Check for function calls
    const functionCalls = candidate.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

    if (functionCalls && functionCalls.length > 0) {
      const call = functionCalls[0];
      if (call && call.name === 'report_safety_violation') {
        return call.args as unknown as ToolCallArgs;
      }
      if (call && call.name === 'report_safe_status') {
         // Map safe status to a "safe" severity event
         const args = call.args as any;
         return {
            severity: 'safe',
            message: 'Routine Check: All Clear',
            location: args.location || 'Zone 1',
            reasoning_steps: args.reasoning_steps || 'No hazards detected.'
         };
      }
    }

    return null;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return null;
  }
};