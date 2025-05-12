const API_KEY = "AIzaSyDIFeql6HUpkZ8JJlr_kuN0WDFHUyOhijA"; // Your actual API Key
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

const savedProfile = localStorage.getItem('userProfile');
if (savedProfile) {
  Object.assign(userProfile, JSON.parse(savedProfile));
}

const surveyFlow = {
  currentStep: 0,
  steps: [
    { type: "name", prompt: "Hello! I'm your personal AI learning assistant. To start, what's your name?", required: true },
    { type: "interests", promptField: "name", prompt: (name) => `Nice to meet you, ${name}! What topics in technology or other areas are you most interested in learning about? (e.g., web development, AI, data science, history)`, required: true },
    { type: "goals", prompt: "Great! And what are your main goals for learning about these topics? (e.g., career change, build a project, general knowledge)", required: true },
    { type: "learning_style", prompt: "Understood. How do you prefer to learn? (e.g., visual examples, hands-on practice, theoretical explanations, a mix)", required: true },
    { type: "summary", prompt: "Thanks for sharing! I'll prepare a summary and we can start your learning journey.", required: true }
  ]
};

let chatHistory = localStorage.getItem('chatHistory') ? JSON.parse(localStorage.getItem('chatHistory')) : [];
let isOnboardingComplete = userProfile.onboardingComplete;
let courseFramework = localStorage.getItem('courseFramework') ?
  JSON.parse(localStorage.getItem('courseFramework')) : null;

const MessageTypes = {
  ONBOARDING: 'onboarding',
  INSTRUCTIONAL: 'instructional',
  DATA_VIZ: 'd3_visualization',
  QUIZ: 'quiz',
  TYPING: 'typing', // For "Bot is typing..."
  SYSTEM_INFO: 'system_info' // For user-initiated action messages
};

// --- Helper Functions ---
function simpleMarkdownToHtml(mdText) {
  if (typeof mdText !== 'string') return '';
  let html = mdText;
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
             .replace(/__(.*?)__/g, '<strong>$1</strong>');
  // Italics: *text* or _text_
  html = html.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>') // Handles single asterisks for italics
             .replace(/_(.*?)_/g, '<em>$1</em>');
  // Strikethrough: ~~text~~
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');
  // Inline code: `code`
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  // Newlines to <br> (Gemini might send \n for paragraphs)
  html = html.replace(/\n/g, '<br>');
  return html;
}

function generateUUID() { // Simple UUID for message IDs
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
    ttsText: ttsText || (typeof text === 'string' ? text.replace(/<[^>]*>?/gm, '') : '') // Basic strip HTML for TTS if not provided
  };
  chatHistory.push(messageObject);
  if (chatHistory.length > 30) { // Keep a reasonable history
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
    messageDiv.className = `message ${msg.isUser ? 'user-message' : msg.type === MessageTypes.TYPING ? 'bot-message typing-indicator' : 'bot-message'}`;
    messageDiv.id = msg.id;

    const messageContentDiv = document.createElement('div');
    messageContentDiv.className = 'message-content';

    if (msg.type === MessageTypes.TYPING) {
      messageContentDiv.textContent = msg.text;
    } else if (msg.type === MessageTypes.QUIZ) {
      try {
        const quizData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text;

        // IMPLEMENTATION OF THE CHANGE IS HERE:
        let questionHtml = `<div class="quiz-question">${simpleMarkdownToHtml(quizData.question)}</div>`; // Wrapped question in div with class

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
        messageContentDiv.textContent = "Error displaying quiz.";
      }
    } else if (msg.type === MessageTypes.DATA_VIZ) {
        try {
            const vizData = typeof msg.text === 'string' ? JSON.parse(msg.text) : msg.text; // Assuming msg.text is vizData JSON or HTML string
            // If msg.text is the HTML string of the visualization already:
            messageContentDiv.innerHTML = msg.text; 

            // Add fullscreen button if the content is indeed a visualization
            // Ensure this button is only added if it's truly viz content and not an error message.
            if (msg.text.includes('<svg') && msg.text.includes('visualization-container')) { // Basic check
                const fullscreenButton = document.createElement('button');
                fullscreenButton.innerHTML = '<i class="fas fa-expand"></i> Fullscreen';
                fullscreenButton.className = 'icon-button fullscreen-viz-button';
                fullscreenButton.onclick = () => openVizInModal(msg.text);
                messageDiv.appendChild(fullscreenButton); // Append to messageDiv, not messageContentDiv
            }

        } catch (e) {
            console.error("Error rendering D3 viz placeholder:", e);
            messageContentDiv.textContent = "Error displaying visualization.";
        }

    } else if (msg.type === MessageTypes.SYSTEM_INFO) {
        messageContentDiv.innerHTML = `<em>${simpleMarkdownToHtml(msg.text)}</em>`;
        // Consider adding a specific class for system messages if not already done
        // messageDiv.classList.add('system-message-style'); 
    } else { // Instructional, Onboarding
      messageContentDiv.innerHTML = simpleMarkdownToHtml(msg.text);
    }
    messageDiv.appendChild(messageContentDiv);

    if (!msg.isUser && msg.type !== MessageTypes.TYPING && msg.type !== MessageTypes.SYSTEM_INFO) {
      // TTS Button
      const ttsButton = document.createElement('button');
      ttsButton.className = 'icon-button tts-button';
      ttsButton.innerHTML = '<i class="fas fa-volume-up"></i>';
      ttsButton.title = 'Read aloud';
      ttsButton.onclick = (e) => {
        e.stopPropagation(); 
        let textToSpeak = msg.ttsText;
        if (msg.type === MessageTypes.QUIZ) {
            try {
                const quizData = JSON.parse(msg.text); // Ensure msg.text is stringified JSON here
                textToSpeak = `Quiz: ${quizData.question}. Options are: ${quizData.options.join(', ')}.`;
            } catch { textToSpeak = "A quiz is available."; }
        } else if (!textToSpeak || textToSpeak === msg.text) { 
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

      // Conditional Action Buttons
      if (msg.suggestions && (msg.suggestions.showVisualizeButton || msg.suggestions.showQuizButton)) {
        const actionButtons = document.createElement('div');
        actionButtons.className = 'message-actions';
        const currentMessageTextForContext = msg.ttsText || (typeof msg.text === 'string' ? msg.text.replace(/<[^>]*>?/gm, '') : '');


        if (msg.suggestions.showVisualizeButton) {
          const vizButton = document.createElement('button');
          vizButton.className = 'icon-button'; // Will be styled by .message-actions .icon-button
          vizButton.innerHTML = '<i class="fas fa-chart-bar"></i> Visualize';
          vizButton.title = 'Generate a visualization for this topic';
          vizButton.onclick = () => triggerVisualizationRequest(currentMessageTextForContext);
          actionButtons.appendChild(vizButton);
        }
        if (msg.suggestions.showQuizButton) {
          const quizButton = document.createElement('button');
          quizButton.className = 'icon-button'; // Will be styled by .message-actions .icon-button
          quizButton.innerHTML = '<i class="fas fa-question-circle"></i> Quiz';
          quizButton.title = 'Take a quiz on this topic';
          quizButton.onclick = () => triggerQuizRequest(currentMessageTextForContext);
          actionButtons.appendChild(quizButton);
        }
        messageDiv.appendChild(actionButtons);
      }
    }
    messagesContainer.appendChild(messageDiv);
  });
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function checkAnswer(messageId, selectedOptionIndex, correctOptionIndex, clickedElement) {
  const message = chatHistory.find(m => m.id === messageId);
  if (!message || message.answered) return; // Prevent re-answering

  message.answered = true; // Mark as answered

  const optionsContainer = clickedElement.parentElement;
  const options = optionsContainer.children;

  Array.from(options).forEach((opt, index) => {
    opt.onclick = null; // Disable further clicks
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
    addMessage(`Not quite. The correct answer was "${options[correctOptionIndex].textContent.trim()}".`, false, MessageTypes.SYSTEM_INFO);
  }
  // No need to call displayMessages manually, addMessage does it.
}


// --- Gemini API Interaction & Logic ---
async function callGeminiAPI(prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp-01-21:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error('Gemini API Error:', response.status, errorBody);
        throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
    }
    const data = await response.json();
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
        console.error('Invalid API response structure:', data);
        throw new Error('Invalid API response structure from Gemini.');
    }
    return data.candidates[0].content.parts[0].text;
}


async function getBotResponse(userMessageText, isFirstMessage = false) {
  const contextMessages = chatHistory
    .slice(-6) // Take last 6 messages for context
    .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.type === MessageTypes.QUIZ ? '[Quiz Content]' : (msg.ttsText || msg.text)}`)
    .join('\n');

  let promptTemplate = '';
  const baseInstructions = `Your response MUST be a single, valid JSON object. No other text, explanations, or conversational fluff should precede or follow this JSON object. Any deviation will cause a system error.
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
For "responseType", use values like 'onboarding_step', 'onboarding_summary', 'instructional', or 'error'.
For "content", provide the user-facing message using simple Markdown for formatting (e.g., **bold**, *italics*). Do NOT use HTML tags in "content".
For "ttsText", provide a plain text version of "content" suitable for speech synthesis.
Example for "suggestions": {"showVisualizeButton": false, "showQuizButton": true, "followUpPrompts": ["Tell me more.", "Give an example."]}
`;
  
  if (!isOnboardingComplete) {
    const currentOnboardingStep = surveyFlow.steps[surveyFlow.currentStep];
    let onboardingPromptContent = '';

    if (isFirstMessage || surveyFlow.currentStep === 0) { // Initial welcome or restarting name
        onboardingPromptContent = currentOnboardingStep.prompt;
        userProfile.name = ''; // Reset name if we are at this step
    } else if (surveyFlow.currentStep > 0 && surveyFlow.currentStep < surveyFlow.steps.length -1) {
        const prevStep = surveyFlow.steps[surveyFlow.currentStep -1];
        // Update profile based on previous step's answer (userMessageText)
        if (prevStep.type === "name") userProfile.name = userMessageText;
        else if (prevStep.type === "interests") userProfile.interests = userMessageText.split(',').map(i => i.trim());
        else if (prevStep.type === "goals") userProfile.goals = userMessageText.split(',').map(g => g.trim());
        else if (prevStep.type === "learning_style") userProfile.learningStyle = userMessageText;

        onboardingPromptContent = typeof currentOnboardingStep.prompt === 'function' ?
            currentOnboardingStep.prompt(userProfile[currentOnboardingStep.promptField] || userMessageText) :
            currentOnboardingStep.prompt;
    }

    if (currentOnboardingStep.type === "summary") {
        // Update last piece of profile info
        if (surveyFlow.steps[surveyFlow.currentStep -1].type === "learning_style") userProfile.learningStyle = userMessageText;

        promptTemplate = `${baseInstructions}
Context: The user is completing their onboarding. Their profile so far:
Name: ${userProfile.name}
Interests: ${userProfile.interests.join(', ')}
Goals: ${userProfile.goals.join(', ')}
Learning Style: ${userProfile.learningStyle}

Task: Provide a friendly summary of their profile, confirm onboarding is complete, and suggest 2-3 initial learning topics based on their interests and goals.
Set responseType to "onboarding_summary". Buttons should be false.
Example 'content': "Great, ${userProfile.name}! Your profile is set up. You're interested in [Interests] to achieve [Goals], preferring a [Learning Style] approach. Based on this, you could start by exploring: 1. Topic A, 2. Topic B. Ready to dive in?"
`;
        } else { // This is the path taken for the initial message
            promptTemplate = `${baseInstructions}

    TASK: You are in an onboarding conversation. Your goal is to ask the user the following question.
    QUESTION_TO_ASK: "${onboardingPromptContent}"

    INSTRUCTIONS FOR YOUR RESPONSE:
    1. Set "responseType" to "onboarding_step".
    2. The "content" field in your JSON response should be ONLY the QUESTION_TO_ASK.
    3. "suggestions.showVisualizeButton" and "suggestions.showQuizButton" must be false.
    4. "suggestions.followUpPrompts" should be an empty array or contain very simple prompts like "Help".
    5. Populate "ttsText" with a plain text version of the QUESTION_TO_ASK.

    Current conversation context (if any):
    ${contextMessages}
    User's last message (if any, likely empty for the first question): "${userMessageText}"
    `;
        }


  } else { // Onboarding is complete
    promptTemplate = `${baseInstructions}
Context: You are providing instructional guidance.
User Profile: Name: ${userProfile.name}, Interests: ${userProfile.interests.join(', ')}, Goals: ${userProfile.goals.join(', ')}, Learning Style: ${userProfile.learningStyle}.
Course Framework (if available): ${JSON.stringify(courseFramework)}
Previous conversation (last 3-5 turns):
${contextMessages}
User's current message: "${userMessageText}"

Task: Provide a focused, helpful, and educational response.
Set responseType to "instructional".
Determine if 'showVisualizeButton' or 'showQuizButton' should be true based on pedagogical value for the current interaction.
If the user's message is unclear, ask for clarification and set buttons to false.`;
  }

    try {
      const rawResponse = await callGeminiAPI(promptTemplate);
      // ADD THIS LINE TO SEE EXACTLY WHAT GEMINI SENT:
      console.log("DEBUG: Raw response from Gemini for main flow:", rawResponse);
      
      // Example of how to extract JSON if it's embedded:
      let jsonStringToParse = rawResponse;
      const firstBrace = rawResponse.indexOf('{');
      const lastBrace = rawResponse.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonStringToParse = rawResponse.substring(firstBrace, lastBrace + 1);
      }
      // Then try:
     const botJsonResponse = JSON.parse(jsonStringToParse);

    // Handle onboarding state progression based on the JSON response
    if (botJsonResponse.responseType === "onboarding_step") {
        // Do nothing here, step progresses after user replies to the bot's question in sendMessage
    } else if (botJsonResponse.responseType === "onboarding_summary") {
        userProfile.onboardingComplete = true;
        isOnboardingComplete = true;
        // courseFramework = generateCourseFramework(chatHistory); // Consider if this needs profile data
        // localStorage.setItem('courseFramework', JSON.stringify(courseFramework));
        surveyFlow.currentStep = surveyFlow.steps.length; // Mark onboarding as done
    }
    userProfile.lastActive = new Date().toISOString();
    localStorage.setItem('userProfile', JSON.stringify(userProfile));

    return botJsonResponse;

  } catch (error) {
    console.error('Error in getBotResponse or parsing:', error, "Prompt:", promptTemplate);
    // Fallback JSON response
    return {
      responseType: "error",
      content: "I'm having a little trouble connecting right now. Please try again in a moment.",
      suggestions: { showVisualizeButton: false, showQuizButton: false, followUpPrompts: [] },
      ttsText: "I'm having a little trouble connecting right now. Please try again in a moment."
    };
  }
}

async function sendMessage() {
  const messageText = userInput.value.trim();
  if (!messageText && !isOnboardingComplete && surveyFlow.currentStep === 0) {
    // Special case for initial message if input is empty but it's the first onboarding step
    // This should be handled by initializeChat instead
    return;
  }
  if (!messageText) return;


  addMessage(messageText, true);
  userInput.value = '';

  const typingIndicatorId = `typing-${generateUUID()}`;
  addMessage("Bot is typing...", false, MessageTypes.TYPING, typingIndicatorId);

  const botJsonResponse = await getBotResponse(messageText);
  removeMessageById(typingIndicatorId);

  addMessage(
    botJsonResponse.content,
    false,
    botJsonResponse.responseType || MessageTypes.INSTRUCTIONAL,
    null,
    botJsonResponse.suggestions,
    botJsonResponse.ttsText
  );

  // Advance onboarding step if it was an onboarding response from the bot
  if (!isOnboardingComplete && botJsonResponse.responseType === "onboarding_step") {
      surveyFlow.currentStep++;
      if (surveyFlow.currentStep >= surveyFlow.steps.length -1 && surveyFlow.steps[surveyFlow.currentStep].type === "summary") {
          // If the next step is summary, trigger it automatically
          const summaryTypingId = `typing-summary-${generateUUID()}`;
          addMessage("Bot is preparing your summary...", false, MessageTypes.TYPING, summaryTypingId);
          const summaryResponse = await getBotResponse("User has provided all info, generate summary.");
          removeMessageById(summaryTypingId);
          addMessage(
              summaryResponse.content,
              false,
              summaryResponse.responseType || MessageTypes.INSTRUCTIONAL,
              null,
              summaryResponse.suggestions,
              summaryResponse.ttsText
          );
      }
  }
}

// --- Specific Action Triggers (Visualize, Quiz) ---
async function triggerVisualizationRequest(contextText) {
  addMessage("Okay, let's try to visualize that. Generating chart data...", false, MessageTypes.SYSTEM_INFO);
  const typingIndicatorId = `typing-viz-${generateUUID()}`;
  addMessage("Bot is creating visualization...", false, MessageTypes.TYPING, typingIndicatorId);

  const promptForViz = `Based on the context: "${contextText.substring(0, 500)}...",
Respond with ONLY valid D3.js compatible JSON data for a bar chart. The JSON format must be:
{
  "type": "bar",
  "title": "Chart Title (be descriptive)",
  "data": [
    {"label": "String: Label A", "value": "Number: Value A"},
    {"label": "String: Label B", "value": "Number: Value B"}
  ],
  "xAxis": "String: X-axis label",
  "yAxis": "String: Y-axis label"
}
Ensure data values are numbers. Provide at least 2 data points, at most 7. Title and axis labels are important.`;

    try {
      const rawResponse = await callGeminiAPI(promptForViz);
      // ADD THIS LINE:
      console.log("DEBUG: Raw response from Gemini for VIZ:", rawResponse);
      removeMessageById(typingIndicatorId);
      const vizData = JSON.parse(rawResponse); 
    
    // Validate structure (basic)
    if (!vizData.type || !vizData.title || !Array.isArray(vizData.data) ||
        !vizData.data.every(d => typeof d.label === 'string' && typeof d.value === 'number')) {
      throw new Error('Invalid visualization data structure from API.');
    }

    const vizContainerId = `d3-viz-${generateUUID()}`;
    const vizHtmlContainer = document.createElement('div');
    vizHtmlContainer.id = vizContainerId;
    vizHtmlContainer.className = 'visualization-container';

    // D3 Rendering Logic (adapted from original)
    const width = 400; // Intrinsic width for the message display
    const height = 300; // Intrinsic height
    const margin = {top: 40, right: 30, bottom: 60, left: 50};

    const svg = d3.select(vizHtmlContainer)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`) // For responsive scaling in modal
      .attr('preserveAspectRatio', 'xMidYMid meet');


    const x = d3.scaleBand()
      .domain(vizData.data.map(d => d.label))
      .range([margin.left, width - margin.right])
      .padding(0.2);

    const y = d3.scaleLinear()
      .domain([0, d3.max(vizData.data, d => d.value) || 10]) // Ensure domain even if max is 0
      .nice()
      .range([height - margin.bottom, margin.top]);

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '14px')
      .style('fill', '#333')
      .text(vizData.title);

    svg.selectAll('.bar')
      .data(vizData.data)
      .join('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.label))
        .attr('y', d => y(d.value))
        .attr('width', x.bandwidth())
        .attr('height', d => Math.max(0, y(0) - y(d.value))) // Ensure height is not negative
        .attr('fill', 'steelblue');

    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-35)");


    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2s"))); // Format ticks (e.g., 1k, 1.5M)


    svg.append('text') // X-axis label
      .attr('x', width / 2)
      .attr('y', height - margin.bottom / 4 + 10)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(vizData.xAxis || "Categories");

    svg.append('text') // Y-axis label
      .attr('transform', 'rotate(-90)')
      .attr('y', margin.left / 2 - 15)
      .attr('x', -(height / 2))
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#333')
      .text(vizData.yAxis || "Values");

    // Add the HTML of the container with the SVG to messages
    addMessage(vizHtmlContainer.outerHTML, false, MessageTypes.DATA_VIZ, null, null, `A bar chart titled "${vizData.title}" has been generated.`);

  } catch (error) {
    console.error('Visualization generation error:', error);
    removeMessageById(typingIndicatorId); // Ensure typing indicator is removed on error
    addMessage("Sorry, I couldn't create that visualization. There might have been an issue with the data format.", false, MessageTypes.SYSTEM_INFO);
  }
}

async function triggerQuizRequest(contextText) {
  addMessage("Sure, let's test your knowledge! Generating a quiz question...", false, MessageTypes.SYSTEM_INFO);
  const typingIndicatorId = `typing-quiz-${generateUUID()}`;
  addMessage("Bot is creating quiz...", false, MessageTypes.TYPING, typingIndicatorId);

  const promptForQuiz = `Based on the context: "${contextText.substring(0,500)}...",
Respond with ONLY a valid JSON object representing a multiple-choice quiz question.
The JSON object must follow this exact structure:
{
  "question": "String: The quiz question itself. Ensure it's clear and concise.",
  "options": ["String: Option A", "String: Option B", "String: Option C", "String: Option D"],
  "correct": "Number: The 0-indexed integer of the correct option (0, 1, 2, or 3)."
}
Provide 4 distinct options. Ensure the question is relevant to the context.`;

    try {
      const rawResponse = await callGeminiAPI(promptForQuiz);
      // ADD THIS LINE:
      console.log("DEBUG: Raw response from Gemini for QUIZ:", rawResponse);
      removeMessageById(typingIndicatorId);
      const quizData = JSON.parse(rawResponse);

    // Validate quizData structure (basic)
    if (!quizData.question || !Array.isArray(quizData.options) || quizData.options.length !== 4 || typeof quizData.correct !== 'number' || quizData.correct < 0 || quizData.correct > 3) {
      throw new Error('Invalid quiz data structure from API.');
    }
    addMessage(JSON.stringify(quizData), false, MessageTypes.QUIZ, null, null, `Quiz time: ${quizData.question}`);
  } catch (error) {
    console.error('Quiz generation error:', error);
    removeMessageById(typingIndicatorId);
    addMessage("Sorry, I couldn't generate a quiz question right now. Please try again.", false, MessageTypes.SYSTEM_INFO);
  }
}


// --- Modal Logic for Visualizations ---
const modal = document.getElementById('fullscreen-modal');
const modalBody = document.getElementById('modal-body');
const modalCloseButton = document.getElementById('modal-close-button');

if (modal && modalCloseButton && modalBody) {
    modalCloseButton.onclick = () => {
      modal.style.display = 'none';
      modalBody.innerHTML = ''; // Clear content
    };
    window.onclick = (event) => { // Close if clicked outside modal content
      if (event.target === modal) {
        modal.style.display = 'none';
        modalBody.innerHTML = '';
      }
    };
}

function openVizInModal(vizContainerHtml) {
  if (!modal || !modalBody) return;
  modalBody.innerHTML = ''; // Clear previous

  // The vizContainerHtml already contains the SVG with its intrinsic dimensions.
  // The CSS for #modal-body svg will make it responsive.
  const contentWrapper = document.createElement('div');
  contentWrapper.innerHTML = vizContainerHtml; // This contains the .visualization-container and its svg

  // We want to take the .visualization-container part and put it in modal body
  const vizElement = contentWrapper.querySelector('.visualization-container');
  if (vizElement) {
      modalBody.appendChild(vizElement.cloneNode(true)); // Clone to avoid issues if original is still in chat
      modal.style.display = 'flex';
  } else {
      console.error("Could not find .visualization-container in provided HTML for modal.");
  }
}


// --- Chat Initialization and Reset ---
async function initializeChat() {
  messagesContainer.innerHTML = ''; // Clear messages visually
  if (!isOnboardingComplete && surveyFlow.currentStep < surveyFlow.steps.length && surveyFlow.steps[surveyFlow.currentStep].type !== "summary") {
    // Start or continue onboarding
    const typingIndicatorId = `typing-init-${generateUUID()}`;
    addMessage("Bot is thinking...", false, MessageTypes.TYPING, typingIndicatorId); // Initial typing indicator
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
  } else if (isOnboardingComplete) {
    const welcomeBackType = `typing-welcome-${generateUUID()}`;
    addMessage("Bot is thinking...",false, MessageTypes.TYPING, welcomeBackType);
    const welcomeBackPrompt = `User ${userProfile.name || ''} has returned. Provide a brief, friendly welcome back message.
    Today's date is ${new Date().toLocaleDateString()}.`;
    const botJsonResponse = await getBotResponse(welcomeBackPrompt); // Normal instructional response
    removeMessageById(welcomeBackType);
     addMessage(
      botJsonResponse.content,
      false,
      botJsonResponse.responseType || MessageTypes.INSTRUCTIONAL,
      null,
      botJsonResponse.suggestions,
      botJsonResponse.ttsText
    );
  } else {
      // Onboarding was completed, or something is out of sync, try general welcome.
      addMessage("Welcome back! How can I help you learn today?", false);
  }
  // Restore chat history from localStorage if not starting fresh onboarding
  if (chatHistory.length > 0 && (isOnboardingComplete || surveyFlow.currentStep > 0)) {
      displayMessages();
  }
}

function resetChat(fullReset = true) { // Parameter to control if profile is cleared
  if (fullReset) {
    localStorage.removeItem('userProfile');
    localStorage.removeItem('courseFramework');
    localStorage.removeItem('chatHistory'); // Clear history on full reset
    Object.assign(userProfile, {
      name: '', interests: [], goals: [], learningStyle: '',
      onboardingComplete: false, lastActive: null
    });
    isOnboardingComplete = false;
    courseFramework = null;
    surveyFlow.currentStep = 0;
    chatHistory = []; // Clear in-memory history
  } else {
    // Soft reset: clear current chat display but keep profile and history for next session
    chatHistory = []; 
    localStorage.removeItem('chatHistory'); // Or just clear current session's visual part
  }
  messagesContainer.innerHTML = '';
  initializeChat();
}

// --- Text Selection Popup (Original logic) ---
let selectionPopup = null;
document.addEventListener('selectionchange', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectionPopup) {
    selectionPopup.remove();
    selectionPopup = null;
  }
  if (selectedText && messagesContainer.contains(selection.anchorNode)) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    selectionPopup = document.createElement('div');
    selectionPopup.className = 'selection-popup';
    selectionPopup.innerHTML = `<button onclick="useSelectedText('${selectedText.replace(/'/g, "\\'")}')" class="icon-button" title="Use Text"><i class="fas fa-paste"></i></button>`;
    selectionPopup.style.top = `${rect.bottom + window.scrollY + 5}px`;
    selectionPopup.style.left = `${rect.left + window.scrollX + (rect.width / 2) - 15}px`; // Centerish
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
  if (e.key === 'Enter') {
    sendMessage();
  }
});

// --- Initial Load ---
initializeChat();
