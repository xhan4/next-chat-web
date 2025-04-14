import { Message } from "./store";

const TIME_OUT_MS = 30000;


export async function createChat() {
 const res = await fetch("/api/create_chat", {
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
  const res = await fetch(`/api/delete_session/${session_id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  return res.json();
 }
export async function requestChat(userInput: string) {
   console.log(userInput,'messages')
  const res = await fetch("/api/chat", {
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
    onMessage: (message: string) => void;
    onError: (error: Error) => void;
  }
) {
  // const req = makeRequestParam(messages, {
  //   filterBot: options?.filterBot,
  // });

  // console.log("[Request] ", req);

  const controller = new AbortController();
  const reqTimeoutId = setTimeout(() => controller.abort(), TIME_OUT_MS);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_input: userInput,session_id:session_id}),
      signal: controller.signal,
    });
    clearTimeout(reqTimeoutId);

    let responseText = await res.json();

    const finish = () => {
      options?.onMessage(responseText.response);
      controller.abort();
    };

    // if (res.ok) {
    //   const reader = res.body?.getReader();
    //   const decoder = new TextDecoder();

    //   while (true) {
    //     // handle time out, will stop if no response in 10 secs
    //     const resTimeoutId = setTimeout(() => finish(), TIME_OUT_MS);
    //     const content = await reader?.read();
    //     clearTimeout(resTimeoutId);
    //     const text = decoder.decode(content?.value);
    //     responseText += text;

    //     const done = !content || content.done;
    //     options?.onMessage(responseText);

    //     if (done) {
    //       break;
    //     }
    //   }

      finish();
    // } else {
    //   console.error("Stream Error");
    //   options?.onError(new Error("Stream Error"));
    // }
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
