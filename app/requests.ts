import { Message } from "./store";

const TIME_OUT_MS = 30000;


export async function createChat() {
 const res = await fetch("/chat_api/create_chat", {
   method: "POST",
   headers: {
     "Content-Type": "application/json",
   },
   body: JSON.stringify({}),
 });

 const data = await res.json();
 return data.session_id;
}
export async function deleteChat(session_id:string) {
  const res = await fetch(`/chat_api/delete_session/${session_id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return res.json();
 }
export async function requestChat(userInput: string) {
   console.log(userInput,'messages')
  const res = await fetch("/chat_api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_input: userInput }),
  });

  return await res.json()
}


export async function requestChatStream(
  userInput: string,
  session_id:string,
  options?: {
    filterBot?: boolean;
    onMessage: (message: string, done: boolean) => void;
    onError: (error: Error) => void;
  }
) {
  const controller = new AbortController();
  const reqTimeoutId = setTimeout(() => controller.abort(), TIME_OUT_MS);

  try {
    const res = await fetch("/chat_api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_input: userInput,
        session_id: session_id
      }),
      signal: controller.signal,
    });
    clearTimeout(reqTimeoutId);

    let responseText = "";
    let lastActionType = "";
    let currentMessage = "";
    let isNewAction = true;

    const finish = () => {
      if (currentMessage) {
        responseText += currentMessage + "\n";
      }
      options?.onMessage(responseText.trim(), true);
      controller.abort();
    };

    if (res.ok) {
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const resTimeoutId = setTimeout(() => finish(), TIME_OUT_MS);
        const content = await reader?.read();
        clearTimeout(resTimeoutId);
        
        if (!content || content.done) {
          finish();
          break;
        }
        
        const text = decoder.decode(content.value);
        
        // Split the text by newlines to handle multiple JSON objects
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim()) {
            try {
              // Remove "data: " prefix if it exists
              const jsonStr = line.replace(/^data: /, '').trim();
              if (!jsonStr) continue;
              
              const jsonData = JSON.parse(jsonStr);
              if (jsonData.content) {
                const actionType = jsonData.type;
                
                // Handle new action type
                if (actionType && lastActionType !== actionType) {
                  if (currentMessage) {
                    responseText += currentMessage + "\n\n\n";
                  }
                  currentMessage = "";
                  isNewAction = true;
                }
                
                // Append new content
                currentMessage += jsonData.content;
                
                // Update response text and notify
                const fullText = (responseText + currentMessage).trim();
                lastActionType = actionType;
                options?.onMessage(fullText, false);
              } else if (jsonData.type === 'done') {
                finish();
                return;
              }
            } catch (e) {
              console.error('Error parsing JSON:', e);
            }
          }
        }
      }
    } else {
      console.error("Stream Error");
      options?.onError(new Error("Stream Error"));
    }
  } catch (err) {
    console.error("NetWork Error");
    options?.onError(new Error("NetWork Error"));
  }
}

export async function requestWithPrompt(messages: Message[], prompt: string) {
  messages = messages.concat([
    {
      role: "user",
      content: prompt,
      date: new Date().toLocaleString(),
    },
  ]);

  const res = await requestChat(prompt);

  return res ?? "";
}
