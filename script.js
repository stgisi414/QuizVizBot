const API_KEY = "AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA"; // Replace with your actual API Key
const messagesContainer = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');

const userProfile = {
  name: '',
  interests: [],
  goals: [],
  learningStyle: '',
  onboardingComplete: false,
  lastActive: null
};

// Attempt to load saved profile, otherwise use defaults
const savedProfileData = localStorage.getItem('userProfile');
if (savedProfileData) {
  Object.assign(userProfile, JSON.parse(savedProfileData));
}

const surveyFlow = {
  currentStep: 0, // Will be potentially overwritten by savedProfile if onboarding was in progress
  steps: [
    { type: "name", prompt: "Hello! I'm your personal AI learning assistant. To start, what's your name?", required: true, promptField: null },
    { type: "interests", promptField: "name", prompt: (name) => `Nice to meet you, ${name}! What topics in technology or other areas are you most interested in learning about? (e.g., web development, AI, data science, history)`, required: true },
    { type: "goals", promptField: null, prompt: "Great! And what are your main goals for learning about these topics? (e.g., career change, build a project, general knowledge)", required: true },
    { type: "learning_style", promptField: null, prompt: "Understood. How do you prefer to learn? (e.g., visual examples, hands-on practice, theoretical explanations, a mix)", required: true },
    { type: "summary", promptField: null, prompt: "Thanks for sharing! I'll prepare a summary and we can start your learning journey.", required: true }
  ]
};

// If a saved profile exists and onboarding wasn't complete, try to restore the step.
if (savedProfileData && !userProfile.onboardingComplete && userProfile.currentSurveyStep !== undefined) {
    surveyFlow.currentStep = userProfile.currentSurveyStep;
} else if (!savedProfileData) { // No saved profile, ensure it's step 0.
    surveyFlow.currentStep = 0;
    userProfile.currentSurveyStep = 0; // Keep profile in sync
}


let chatHistory = []; // Default to empty
let isOnboardingComplete = userProfile.onboardingComplete;
let courseFramework = localStorage.getItem('courseFramework') ?
  JSON.parse(localStorage.getItem('courseFramework')) : null;

const MessageTypes = {
  ONBOARDING_STEP: 'onboarding_step',
  ONBOARDING_SUMMARY: 'onboarding_summary',
  INSTRUCTIONAL: 'instructional',
  DATA_VIZ: 'd3_visualization',
  QUIZ: 'quiz',
  TYPING: 'typing',
  SYSTEM_INFO: 'system_info',
  ERROR: 'error'
};

// --- Helper Functions ---
function simpleMarkdownToHtml(mdText) {
  if (typeof mdText !== 'string') return '';
  let html = mdText;
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
             .replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
             .replace(/_(.*?)_/g, '<em>$1</em>');
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function generateUUID() {
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

// --- Message Display & Management ---
function addMessage(text, isUser, type = MessageTypes.INSTRUCTIONAL, id = null, suggestions = null, ttsText = null) {
  const messageObject = {
    id: id || generateUUID(),
    text,
    isUser,
    type,
    timestamp: new Date().toISOString(),
    suggestions: suggestions || { showVisualizeButton: false, showQuizButton: false, followUpPrompts: [] },
    ttsText: ttsText || (typeof text === 'string' ? text.replace(/<[^>]*>?/gm, '') : (type === MessageTypes.QUIZ || type === MessageTypes.DATA_VIZ ? "Interactive content." : ""))
  };
  chatHistory.push(messageObject);
  if (chatHistory.length > 50) {
    chatHistory.shift();
  }
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
  displayMessages();
}

function removeMessageById(id) {
  chatHistory = chatHistory.filter(msg => msg.id !== id);
  displayMessages();
}

function displayMessages() {
  messagesContainer.innerHTML = '';
  chatHistory.forEach(msg => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${msg.isUser ? 'user-message' : (msg.type === MessageTypes.TYPING ? 'bot-message typing-indicator' : 'bot-message')}`;
    messageDiv.id = msg.id;

    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';

    if (msg.type === MessageTypes.TYPING) {
      messageContentDiv.textContent = msg.text;
    } else if (msg.type === MessageTypes.QUIZ) {
      try {
        const quizData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text;
        let questionHtml = `<div class="quiz-question">${simpleMarkdownToHtml(quizData.question)}</div>`;
        questionHtml += '<div class="quiz-options">';
        quizData.options.forEach((option, index) => {
          questionHtml += `
            <div class="quiz-option" onclick="checkAnswer('${msg.id}', ${index}, ${quizData.correct}, this)">
              ${simpleMarkdownToHtml(option)}
            </div>`;
        });
        questionHtml += '</div>';
        messageContentDiv.innerHTML = questionHtml;
      } catch (e) {
        console.error("Error parsing quiz data:", e, msg.text);
        messageContentDiv.innerHTML = simpleMarkdownToHtml("Error displaying quiz.");
      }
    } else if (msg.type === MessageTypes.DATA_VIZ) {
        try {
            messageContentDiv.innerHTML = msg.text; // msg.text is expected to be the HTML string of the viz
            if (msg.text.includes('<svg') && msg.text.includes('visualization-container')) {
                const fullscreenButton = document.createElement('button');
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
                fullscreenButton.className = 'icon-button fullscreen-viz-button';
                fullscreenButton.onclick = () => openVizInModal(msg.text);
                messageDiv.appendChild(fullscreenButton);
            }
        } catch (e) {
            console.error("Error rendering D3 viz placeholder:", e);
            messageContentDiv.innerHTML = simpleMarkdownToHtml("Error displaying visualization.");
        }
    } else if (msg.type === MessageTypes.SYSTEM_INFO || msg.type === MessageTypes.ERROR) {
        messageContentDiv.innerHTML = `<em>${simpleMarkdownToHtml(msg.text)}</em>`;
        if (msg.type === MessageTypes.ERROR) messageDiv.classList.add('error-message-style'); // Add a class for error styling
        else messageDiv.classList.add('system-message-style');
    } else {
      messageContentDiv.innerHTML = simpleMarkdownToHtml(msg.text);
    }
    messageDiv.appendChild(messageContentDiv);

    if (!msg.isUser && msg.type !== MessageTypes.TYPING && msg.type !== MessageTypes.SYSTEM_INFO && msg.type !== MessageTypes.ERROR) {
      const ttsButton = document.createElement('button');
      ttsButton.className = 'icon-button tts-button';
      ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
      ttsButton.title = 'Read aloud';
      ttsButton.onclick = (e) => {
        e.stopPropagation();
        let textToSpeak = msg.ttsText;
         if (msg.type === MessageTypes.QUIZ) {
            try {
                const quizData = JSON.parse(msg.text);
                textToSpeak = `Quiz: ${quizData.question}. Options are: ${quizData.options.join(', ')}.`;
            } catch { textToSpeak = "A quiz is available."; }
        } else if (!textToSpeak || textToSpeak === msg.text.replace(/<[^>]*>?/gm, '')) { // Check if ttsText is just stripped content
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = msg.text;
            textToSpeak = tempDiv.textContent || tempDiv.innerText || "";
        }
        if (textToSpeak) {
          speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          speechSynthesis.speak(utterance);
        }
      };
      messageDiv.appendChild(ttsButton);

      if (msg.suggestions && (msg.suggestions.showVisualizeButton || msg.suggestions.showQuizButton || (msg.suggestions.followUpPrompts && msg.suggestions.followUpPrompts.length > 0))) {
        const actionButtons = document.createElement('div');
        actionButtons.className = 'message-actions';
        const currentMessageTextForContext = msg.ttsText || msg.text.replace(/<[^>]*>?/gm, '');

        if (msg.suggestions.showVisualizeButton) {
          const vizButton = document.createElement('button');
          vizButton.className = 'icon-button';
          vizButton.innerHTML = '<i class="fas fa-chart-bar"></i> Visualize';
          vizButton.title = 'Generate a visualization';
          vizButton.onclick = () => triggerVisualizationRequest(currentMessageTextForContext);
          actionButtons.appendChild(vizButton);
        }
        if (msg.suggestions.showQuizButton) {
          const quizButton = document.createElement('button');
          quizButton.className = 'icon-button';
          quizButton.innerHTML = '<i class="fas fa-question-circle"></i> Quiz';
          quizButton.title = 'Take a quiz';
          quizButton.onclick = () => triggerQuizRequest(currentMessageTextForContext);
          actionButtons.appendChild(quizButton);
        }
        // Add follow-up prompts as buttons
        if (msg.suggestions.followUpPrompts && msg.suggestions.followUpPrompts.length > 0) {
            msg.suggestions.followUpPrompts.forEach(promptText => {
                if (typeof promptText === 'string' && promptText.trim() !== '') { // Ensure it's a valid string
                    const promptButton = document.createElement('button');
                    promptButton.className = 'icon-button follow-up-prompt'; // Add a class for styling if needed
                    promptButton.textContent = promptText;
                    promptButton.title = `Send: ${promptText}`;
                    promptButton.onclick = () => {
                        userInput.value = promptText;
                        sendMessage();
                    };
                    actionButtons.appendChild(promptButton);
                }
            });
        }
        if (actionButtons.hasChildNodes()) { // Only append if there are actual buttons
           messageDiv.appendChild(actionButtons);
        }
      }
    }
    messagesContainer.appendChild(messageDiv);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function checkAnswer(messageId, selectedOptionIndex, correctOptionIndex, clickedElement) {
  const message = chatHistory.find(m => m.id === messageId);
  if (!message || message.answered) return;

  message.answered = true;

  const optionsContainer = clickedElement.parentElement;
  const options = Array.from(optionsContainer.children);

  options.forEach((opt, index) => {
    opt.onclick = null;
    opt.classList.add('disabled');
    if (index === correctOptionIndex) {
      opt.classList.add('correct');
    }
    if (index === selectedOptionIndex && index !== correctOptionIndex) {
      opt.classList.add('incorrect');
    }
  });

  if (selectedOptionIndex === correctOptionIndex) {
    addMessage("Correct! Well done!", false, MessageTypes.SYSTEM_INFO);
  } else {
    addMessage(`Not quite. The correct answer was "${simpleMarkdownToHtml(options[correctOptionIndex].innerHTML)}".`, false, MessageTypes.SYSTEM_INFO);
  }
}

// --- Gemini API Interaction & Logic ---
const baseInstructions = `CRITICAL: Your entire response MUST be a single, valid JSON object.
Absolutely NO text, explanations, apologies, or any other characters should precede or follow this JSON object.
Any deviation from a pure JSON response will cause a critical system failure.
The required JSON object structure is:
{
  "responseType": "String",
  "content": "String",
  "suggestions": {
    "showVisualizeButton": Boolean,
    "showQuizButton": Boolean,
    "followUpPrompts": ["Array of Strings"]
  },
  "ttsText": "String"
}
Details for each field:
- "responseType": Use one of the exact string values: 'onboarding_step', 'onboarding_summary', 'instructional', 'error'.
- "content": This is the user-facing message. Use simple Markdown for formatting (e.g., **bold**, *italics*). DO NOT use any HTML tags in the "content" field.
- "suggestions": This MUST be an object containing 'showVisualizeButton' (Boolean), 'showQuizButton' (Boolean), and 'followUpPrompts' (an array of strings, can be empty []). Ensure followUpPrompts are short and relevant.
- "ttsText": This is the plain text version of the "content" field, suitable for speech synthesis.
Ensure all string values within the JSON are correctly formatted and escaped if they contain special characters (like quotes or newlines within the string).
Do not add any comments or extra text inside the JSON structure itself.
`;

async function callGeminiAPI(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`, { // Using gemini-1.5-flash
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Gemini API Error (response not ok):', response.status, errorBody);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error('Invalid API response structure (no candidate text):', data);
        throw new Error('Invalid API response structure from Gemini.');
    }
    return data.candidates[0].content.parts[0].text;
}

function cleanAndParseGeminiResponse(rawResponseString) {
    let cleanedResponse = rawResponseString.trim();

    if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.substring(7); // Remove ```json\n
        if (cleanedResponse.endsWith("```")) {
            cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
        }
    } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.substring(3);
         if (cleanedResponse.endsWith("```")) {
            cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
        }
    }
    cleanedResponse = cleanedResponse.trim();

    try {
        return JSON.parse(cleanedResponse);
    } catch (parseError) {
        console.error("Failed to parse cleaned JSON response:", parseError);
        console.error("Cleaned response string that failed parsing:", cleanedResponse);
        console.error("Original raw response string:", rawResponseString);
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            const extractedJson = cleanedResponse.substring(firstBrace, lastBrace + 1);
            try {
                console.log("Attempting to parse extracted JSON:", extractedJson);
                return JSON.parse(extractedJson);
            } catch (secondParseError) {
                console.error("Failed to parse even the extracted JSON:", secondParseError);
                throw secondParseError;
            }
        }
        throw parseError;
    }
}


async function getBotResponse(userMessageText, isFirstMessage = false) {
  const contextMessages = chatHistory
    .slice(-6)
    .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.type === MessageTypes.QUIZ ? '[Quiz Content]' : (msg.ttsText || msg.text.replace(/<[^>]*>?/gm, ''))}`)
    .join('\n');

  let promptTemplate = '';

  if (!isOnboardingComplete) {
    if (!isFirstMessage) {
      const stepBeingAnswered = surveyFlow.steps[surveyFlow.currentStep];
      if (stepBeingAnswered) {
        if (stepBeingAnswered.type === "name") userProfile.name = userMessageText;
        else if (stepBeingAnswered.type === "interests") userProfile.interests = userMessageText.split(',').map(i => i.trim());
        else if (stepBeingAnswered.type === "goals") userProfile.goals = userMessageText.split(',').map(g => g.trim());
        else if (stepBeingAnswered.type === "learning_style") userProfile.learningStyle = userMessageText;
      }
      if (surveyFlow.currentStep < surveyFlow.steps.length - 1) {
        surveyFlow.currentStep++;
      }
    } else { // This is the absolute first call for onboarding from initializeChat
      surveyFlow.currentStep = 0; // Ensure we are at the beginning
      userProfile.name = '';
      userProfile.interests = [];
      userProfile.goals = [];
      userProfile.learningStyle = '';
    }
    userProfile.currentSurveyStep = surveyFlow.currentStep; // Keep profile in sync with current step for persistence

    const currentOnboardingStep = surveyFlow.steps[surveyFlow.currentStep];
    let onboardingPromptContent = '';

    if (currentOnboardingStep.type === "summary") {
      promptTemplate = `${baseInstructions}\n\nTASK: You are an AI educational assistant concluding an onboarding process.
The user's profile is:\nName: ${userProfile.name || 'N/A'}\nInterests: ${userProfile.interests.join(', ') || 'N/A'}\nGoals: ${userProfile.goals.join(', ') || 'N/A'}\nLearning Style: ${userProfile.learningStyle || 'N/A'}
INSTRUCTIONS FOR YOUR RESPONSE:\n1. Set "responseType" to "onboarding_summary".\n2. In "content", provide a friendly summary of their profile. Confirm onboarding is complete. Suggest 2-3 specific initial learning topics based on their interests and goals. Example "content": "Great, ${userProfile.name || 'User'}! Your profile is set up. You're interested in ${userProfile.interests.join(', ') || 'various topics'} to achieve ${userProfile.goals.join(', ') || 'your objectives'}, preferring a ${userProfile.learningStyle || 'flexible'} approach. Based on this, you could start by exploring: 1. Topic A, 2. Topic B. Ready to dive in?".\n3. "suggestions.showVisualizeButton" and "suggestions.showQuizButton" MUST be false.\n4. "suggestions.followUpPrompts" can be ["Let's start with Topic A", "Suggest other topics", "What can you teach me?"].\n5. Populate "ttsText" with a plain text version of your "content".`;
    } else {
      if (typeof currentOnboardingStep.prompt === 'function') {
        const promptArgKey = currentOnboardingStep.promptField;
        const promptArgValue = userProfile[promptArgKey];
        onboardingPromptContent = currentOnboardingStep.prompt(promptArgValue || (promptArgKey === 'name' ? (userProfile.name || "there") : "details"));
      } else {
        onboardingPromptContent = currentOnboardingStep.prompt;
      }
      promptTemplate = `${baseInstructions}\n\nTASK: You are in an onboarding conversation. Your goal is to ask the user the following question to gather information for their profile.
QUESTION_TO_ASK: "${onboardingPromptContent}"
INSTRUCTIONS FOR YOUR RESPONSE:\n1. Set "responseType" to "onboarding_step".\n2. The "content" field in your JSON response should be ONLY the QUESTION_TO_ASK.\n3. "suggestions.showVisualizeButton" and "suggestions.showQuizButton" MUST be false.\n4. "suggestions.followUpPrompts" should be an empty array [].\n5. Populate "ttsText" with a plain text version of the QUESTION_TO_ASK.
Current conversation context (last few turns):\n${contextMessages}\nUser's response to previous question (if any): "${userMessageText}"`;
    }
  } else {
    promptTemplate = `${baseInstructions}\n\nTASK: You are an AI educational assistant providing instructional guidance.
User Profile: Name: ${userProfile.name || 'User'}, Interests: ${userProfile.interests.join(', ') || 'Not specified'}, Goals: ${userProfile.goals.join(', ') || 'Not specified'}, Learning Style: ${userProfile.learningStyle || 'Not specified'}.
Course Framework (if available): ${JSON.stringify(courseFramework)}
Previous conversation (last 3-5 turns):\n${contextMessages}\nUser's current message: "${userMessageText}"
INSTRUCTIONS FOR YOUR RESPONSE:\n1. Set "responseType" to "instructional".\n2. Provide a focused, helpful, and educational response in the "content" field. Be conversational and engaging.\n3. Determine if "suggestions.showVisualizeButton" or "suggestions.showQuizButton" should be true based on clear pedagogical value. Only set to true if the content is directly suitable for visualization or a quiz. Otherwise, set to false.\n4. Populate "suggestions.followUpPrompts" with 2-3 relevant short suggestions for what the user might ask or do next. These should be natural continuations of the conversation.\n5. Populate "ttsText" with a plain text version of your "content".\nIf the user's message is unclear, "content" should ask for clarification, and buttons should be false, with followUpPrompts like ["Can you explain further?", "What did you mean by that?"].`;
  }

  try {
    // console.log("DEBUG: Sending this prompt to Gemini:", promptTemplate);
    const rawResponse = await callGeminiAPI(promptTemplate);
    console.log("DEBUG: Raw response from Gemini for main flow:", rawResponse);
    const botJsonResponse = cleanAndParseGeminiResponse(rawResponse);

    if (botJsonResponse.responseType === MessageTypes.ONBOARDING_SUMMARY) {
      userProfile.onboardingComplete = true;
      isOnboardingComplete = true;
      // surveyFlow.currentStep is already at the summary step.
    }
    userProfile.lastActive = new Date().toISOString();
    localStorage.setItem('userProfile', JSON.stringify(userProfile)); // Save profile, including currentSurveyStep

    return botJsonResponse;
  } catch (error) {
    console.error('Error in getBotResponse or parsing:', error, "\nPrompt that caused error:\n", promptTemplate);
    return {
      responseType: MessageTypes.ERROR,
      content: "I'm having a little trouble processing that. Could you try rephrasing, or ask something else?",
      suggestions: { showVisualizeButton: false, showQuizButton: false, followUpPrompts: ["Try again", "Ask something else"] },
      ttsText: "I'm having a little trouble processing that. Could you try rephrasing, or ask something else?"
    };
  }
}

async function sendMessage() {
  const messageText = userInput.value.trim();
  if (!messageText) return;

  addMessage(messageText, true);
  userInput.value = '';
  userInput.focus();

  const typingIndicatorId = `typing-${generateUUID()}`;
  addMessage("Bot is typing...", false, MessageTypes.TYPING, typingIndicatorId);

  const botJsonResponse = await getBotResponse(messageText, false);
  removeMessageById(typingIndicatorId);

  addMessage(
    botJsonResponse.content,
    false,
    botJsonResponse.responseType || MessageTypes.INSTRUCTIONAL,
    null,
    botJsonResponse.suggestions,
    botJsonResponse.ttsText
  );
}

// --- Specific Action Triggers (Visualize, Quiz) ---
async function triggerVisualizationRequest(contextText) {
  addMessage("Okay, let's try to visualize that. Generating chart data...", false, MessageTypes.SYSTEM_INFO);
  const typingIndicatorId = `typing-viz-${generateUUID()}`;
  addMessage("Bot is creating visualization...", false, MessageTypes.TYPING, typingIndicatorId);

  const promptForViz = `CRITICAL: Respond with ONLY a valid D3.js compatible JSON data object for a bar chart. No other text or markdown.
The data should be relevant to the context: "${contextText.substring(0, 500)}...".
The JSON format must be exactly:
{
  "type": "bar",
  "title": "Chart Title (be descriptive and concise)",
  "data": [
    {"label": "String: Label A", "value": "Number: Value A"},
    {"label": "String: Label B", "value": "Number: Value B"}
  ],
  "xAxis": "String: X-axis label",
  "yAxis": "String: Y-axis label"
}
Ensure "data" values are numbers. Provide at least 2 data points, at most 7. "title", "xAxis", and "yAxis" labels are important.`;

  try {
    const rawResponse = await callGeminiAPI(promptForViz);
    removeMessageById(typingIndicatorId);
    console.log("DEBUG: Raw response from Gemini for VIZ:", rawResponse);
    const vizData = cleanAndParseGeminiResponse(rawResponse);

    if (!vizData.type || vizData.type !== "bar" || !vizData.title || !Array.isArray(vizData.data) ||
        !vizData.data.every(d => typeof d.label === 'string' && typeof d.value === 'number') || !vizData.xAxis || !vizData.yAxis) {
      throw new Error('Invalid visualization data structure received from API.');
    }

    const vizContainerId = `d3-viz-${generateUUID()}`;
    const vizHtmlContainer = document.createElement('div');
    vizHtmlContainer.id = vizContainerId;
    vizHtmlContainer.className = 'visualization-container';

    const width = 400, height = 300;
    const margin = {top: 40, right: 30, bottom: 70, left: 60}; // Increased bottom margin for rotated labels

    const svg = d3.select(vizHtmlContainer).append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const x = d3.scaleBand()
      .domain(vizData.data.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(vizData.data, d => d.value) || 10])
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append('text').attr('x', width / 2).attr('y', margin.top / 2).attr('text-anchor', 'middle').style('font-size', '16px').style('font-weight', 'bold').text(vizData.title);

    svg.selectAll('.bar').data(vizData.data).join('rect').attr('class', 'bar')
      .attr('x', d => x(d.label)).attr('y', d => y(d.value))
      .attr('width', x.bandwidth()).attr('height', d => Math.max(0, y(0) - y(d.value)))
      .attr('fill', 'steelblue');

    svg.append('g').attr('transform', `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text").style("text-anchor", "end").attr("dx", "-.8em").attr("dy", ".15em").attr("transform", "rotate(-45)");

    svg.append('g').attr('transform', `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s")));

    svg.append('text').attr('x', width / 2).attr('y', height - margin.bottom / 2 + 25).attr('text-anchor', 'middle').style('font-size', '12px').text(vizData.xAxis);
    svg.append('text').attr('transform', 'rotate(-90)').attr('y', margin.left / 2 - 25).attr('x', -(height / 2)).attr('text-anchor', 'middle').style('font-size', '12px').text(vizData.yAxis);

    addMessage(vizHtmlContainer.outerHTML, false, MessageTypes.DATA_VIZ, null, null, `A bar chart titled "${vizData.title}" has been generated.`);
  } catch (error) {
    console.error('Visualization generation error:', error);
    removeMessageById(typingIndicatorId);
    addMessage("Sorry, I couldn't create that visualization. There might have been an issue with the data format received.", false, MessageTypes.ERROR);
  }
}

async function triggerQuizRequest(contextText) {
  addMessage("Sure, let's test your knowledge! Generating a quiz question...", false, MessageTypes.SYSTEM_INFO);
  const typingIndicatorId = `typing-quiz-${generateUUID()}`;
  addMessage("Bot is creating quiz...", false, MessageTypes.TYPING, typingIndicatorId);

  const promptForQuiz = `CRITICAL: Respond with ONLY a valid JSON object for a multiple-choice quiz. No other text or markdown.
Based on the context: "${contextText.substring(0,500)}...",
The JSON object must follow this exact structure:
{
  "question": "String: The quiz question itself. Clear and concise.",
  "options": ["String: Option A", "String: Option B", "String: Option C", "String: Option D"],
  "correct": "Number: The 0-indexed integer of the correct option (0, 1, 2, or 3)."
}
Provide exactly 4 distinct options. Ensure the question is relevant.`;

  try {
    const rawResponse = await callGeminiAPI(promptForQuiz);
    removeMessageById(typingIndicatorId);
    console.log("DEBUG: Raw response from Gemini for QUIZ:", rawResponse);
    const quizData = cleanAndParseGeminiResponse(rawResponse);

    if (!quizData.question || !Array.isArray(quizData.options) || quizData.options.length !== 4 || typeof quizData.correct !== 'number' || quizData.correct < 0 || quizData.correct > 3) {
      throw new Error('Invalid quiz data structure received from API.');
    }
    addMessage(JSON.stringify(quizData), false, MessageTypes.QUIZ, null, null, `Quiz time: ${quizData.question}`);
  } catch (error) {
    console.error('Quiz generation error:', error);
    removeMessageById(typingIndicatorId);
    addMessage("Sorry, I couldn't generate a quiz question right now. Please try again.", false, MessageTypes.ERROR);
  }
}

// --- Modal Logic for Visualizations ---
const modal = document.getElementById('fullscreen-modal');
const modalBody = document.getElementById('modal-body');
const modalCloseButton = document.getElementById('modal-close-button');

if (modal && modalCloseButton && modalBody) {
    modalCloseButton.onclick = () => {
      modal.style.display = 'none';
      modalBody.innerHTML = '';
    };
    modal.addEventListener('click', (event) => { // Use modal itself for click outside
        if (event.target === modal) {
            modal.style.display = 'none';
            modalBody.innerHTML = '';
        }
    });
}

function openVizInModal(vizContainerHtml) {
  if (!modal || !modalBody) return;
  modalBody.innerHTML = '';
  const contentWrapper = document.createElement('div');
  contentWrapper.innerHTML = vizContainerHtml;
  const vizElement = contentWrapper.querySelector('.visualization-container');
  if (vizElement) {
      modalBody.appendChild(vizElement.cloneNode(true));
      modal.style.display = 'flex';
  } else {
      console.error("Could not find .visualization-container in provided HTML for modal.");
      modalBody.innerHTML = "<p>Error displaying visualization in fullscreen.</p>";
      modal.style.display = 'flex';
  }
}

// --- Chat Initialization and Reset ---
async function initializeChat() {
  messagesContainer.innerHTML = '';

  const savedProfile = localStorage.getItem('userProfile');
  if (savedProfile) {
    Object.assign(userProfile, JSON.parse(savedProfile));
    isOnboardingComplete = userProfile.onboardingComplete;
    if (userProfile.currentSurveyStep !== undefined) {
        surveyFlow.currentStep = userProfile.currentSurveyStep;
    } else { // If old profile without currentSurveyStep, default for incomplete onboarding
        surveyFlow.currentStep = isOnboardingComplete ? surveyFlow.steps.length : 0;
        userProfile.currentSurveyStep = surveyFlow.currentStep;
    }
  } else { // No saved profile, fresh start
    isOnboardingComplete = false;
    userProfile.onboardingComplete = false;
    surveyFlow.currentStep = 0;
    userProfile.currentSurveyStep = 0;
    Object.assign(userProfile, { name: '', interests: [], goals: [], learningStyle: '', lastActive: null });
  }

  const savedChatHistory = localStorage.getItem('chatHistory');
  if (savedChatHistory) {
    chatHistory = JSON.parse(savedChatHistory);
  } else {
    chatHistory = [];
  }

  if (!isOnboardingComplete) {
    if (chatHistory.length === 0 && surveyFlow.currentStep < surveyFlow.steps.length && surveyFlow.steps[surveyFlow.currentStep].type !== "summary") {
      // Fresh start for this onboarding step, or completely new onboarding
      const typingIndicatorId = `typing-init-${generateUUID()}`;
      addMessage("Bot is thinking...", false, MessageTypes.TYPING, typingIndicatorId);
      const botJsonResponse = await getBotResponse("", true); // isFirstMessage = true
      removeMessageById(typingIndicatorId);
      addMessage(
        botJsonResponse.content,
        false,
        botJsonResponse.responseType || MessageTypes.INSTRUCTIONAL,
        null,
        botJsonResponse.suggestions,
        botJsonResponse.ttsText
      );
    } else {
      // Resuming onboarding, display existing messages.
      // The last message should ideally be the bot's question for surveyFlow.currentStep
      displayMessages();
    }
  } else { // Onboarding is complete
    displayMessages(); // Display history first
    if (chatHistory.length === 0 || (chatHistory.length > 0 && chatHistory[chatHistory.length-1].isUser)) { // Add welcome only if no bot message is last or chat is empty
        addMessage(
            `Welcome back, ${userProfile.name || 'learner'}! How can I assist your learning journey today?`,
            false,
            MessageTypes.INSTRUCTIONAL,
            null,
            { showVisualizeButton: false, showQuizButton: false, followUpPrompts: ["Suggest a learning topic", "What did we discuss last time?", "Give me a fun fact!"] }
        );
    }
  }
}

function resetChat(fullReset = true) {
  if (fullReset) {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('courseFramework');
    localStorage.removeItem('chatHistory');
    Object.assign(userProfile, {
      name: '', interests: [], goals: [], learningStyle: '',
      onboardingComplete: false, lastActive: null, currentSurveyStep: 0
    });
    isOnboardingComplete = false;
    courseFramework = null;
    surveyFlow.currentStep = 0;
    chatHistory = [];
  } else { // Soft reset: clear displayed chat, keep profile for next session start.
    chatHistory = [];
    localStorage.removeItem('chatHistory');
  }
  messagesContainer.innerHTML = '';
  initializeChat(); // Re-initialize to start onboarding or show welcome
}


// --- Text Selection Popup ---
let selectionPopup = null;
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
  if (selectedText && messagesContainer.contains(selection.anchorNode) && selection.anchorNode.parentElement.closest('.message')) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionPopup = document.createElement('div');
    selectionPopup.className = 'selection-popup';
    selectionPopup.innerHTML = `<button onclick="useSelectedText('${selectedText.replace(/'/g, "\\'")}')" class="icon-button" title="Use Text"><i class="fas fa-paste"></i></button>`;
    selectionPopup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    selectionPopup.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 20}px`;
    document.body.appendChild(selectionPopup);
  }
});

function useSelectedText(text) {
  userInput.value = text;
  userInput.focus();
  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
}

userInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { // Send on Enter, allow Shift+Enter for new line if textarea
    e.preventDefault(); // Prevent default Enter behavior (like newline in input)
    sendMessage();
  }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', () => {
    initializeChat();
    document.getElementById('send-button').addEventListener('click', sendMessage);
    document.getElementById('reset-button').addEventListener('click', () => resetChat(true));
});

// Make sure your HTML has buttons with id="send-button" and id="reset-button"
// e.g., <button id="send-button" class="icon-button" title="Send Message"><i class="fas fa-paper-plane"></i></button>
//       <button id="reset-button" class="icon-button" title="Reset Chat"><i class="fas fa-sync"></i></button>
