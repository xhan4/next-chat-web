import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createChat, deleteChat, requestChatStream, requestWithPrompt } from "./requests";
import { trimTopic } from "./utils";

import Locale from "./locales";

export type Message ={
  role:string
  date?: string;
  content:string
  streaming?: boolean,
};

export enum SubmitKey {
  Enter = "Enter",
  CtrlEnter = "Ctrl + Enter",
  ShiftEnter = "Shift + Enter",
  AltEnter = "Alt + Enter",
}

export enum Theme {
  Auto = "auto",
  Dark = "dark",
  Light = "light",
}

export interface ChatConfig {
  maxToken?: number;
  historyMessageCount: number; // -1 means all
  compressMessageLengthThreshold: number;
  sendBotMessages: boolean; // send bot's message or not
  submitKey: SubmitKey;
  avatar: string;
  theme: Theme;
  tightBorder: boolean;
}

export function isValidNumber(x: number, min: number, max: number) {
  return typeof x === "number" && x <= max && x >= min;
}


const DEFAULT_CONFIG: ChatConfig = {
  historyMessageCount: 4,
  compressMessageLengthThreshold: 1000,
  sendBotMessages: true as boolean,
  submitKey: SubmitKey.CtrlEnter as SubmitKey,
  avatar: "1f603",
  theme: Theme.Auto as Theme,
  tightBorder: false,

};

export interface ChatStat {
  tokenCount: number;
  wordCount: number;
  charCount: number;
}

export interface ChatSession {
  id: string;
  topic: string;
  memoryPrompt: string;
  messages: Message[];
  stat: ChatStat;
  lastUpdate: string;
  lastSummarizeIndex: number;
}

const DEFAULT_TOPIC = Locale.Store.DefaultTopic;

async function createEmptySession(): Promise<ChatSession> {
  const sessionId = await createChat()
  const createDate = new Date().toLocaleString();

  return {
    id:sessionId,
    topic: DEFAULT_TOPIC,
    memoryPrompt: "",
    messages: [
      {
        role: "assistant",
        content: Locale.Store.BotHello,
        date: createDate,
      },
    ],
    stat: {
      tokenCount: 0,
      wordCount: 0,
      charCount: 0,
    },
    lastUpdate: createDate,
    lastSummarizeIndex: 0,
  };
}

interface ChatStore {
  config: ChatConfig;
  sessions: ChatSession[];
  currentSessionIndex: number;
  removeSession: (index: number,sessions:ChatSession[]) => void;
  selectSession: (index: number) => void;
  newSession: () => void;
  currentSession: () => ChatSession;
  onNewMessage: (message: Message) => void;
  onUserInput: (content: string,id:string) => Promise<void>;
  summarizeSession: () => void;
  updateStat: (message: Message) => void;
  updateCurrentSession: (updater: (session: ChatSession) => void) => void;
  updateMessage: (
    sessionIndex: number,
    messageIndex: number,
    updater: (message?: Message) => void
  ) => void;
  getMessagesWithMemory: () => Message[];
  getMemoryPrompt: () => Message;

  getConfig: () => ChatConfig;
  resetConfig: () => void;
  updateConfig: (updater: (config: ChatConfig) => void) => void;
  clearAllData: () => void;
  initializeStore:()=>Promise<any>
}

const LOCAL_KEY = "chat-next-web-store";

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionIndex: 0,
      initializeStore: async () => {
        const initialSession = await createEmptySession();
        set({ sessions: [initialSession], currentSessionIndex: 0 });
      },
      config: {
        ...DEFAULT_CONFIG,
      },

      resetConfig() {
        set(() => ({ config: { ...DEFAULT_CONFIG } }));
      },

      getConfig() {
        return get().config;
      },

      updateConfig(updater) {
        const config = get().config;
        updater(config);
        set(() => ({ config }));
      },

      selectSession(index: number) {
        set({
          currentSessionIndex: index,
        });
      },

      async removeSession(index: number,sessions:ChatSession[]) {
        await deleteChat(sessions[String(index)].id)
        if (sessions.length === 1) {
          const newSession = await createEmptySession();
          set((state) => {
              return {
                currentSessionIndex: 0,
                sessions: [newSession],
              };
            }
          )
        }else{
          set((state) => {
            let nextIndex = state.currentSessionIndex;
            const sessions = state.sessions;  
            sessions.splice(index, 1);
  
            if (nextIndex === index) {
              nextIndex -= 1;
            }
  
            return {
              currentSessionIndex: nextIndex,
              sessions,
            };
          });
        }
   
      },

      async newSession() {
        const newSession = await createEmptySession();
        set((state) => ({
          currentSessionIndex: 0,
          sessions: [newSession].concat(state.sessions),
        }));
      },

      currentSession() {
        let index = get().currentSessionIndex;
        const sessions = get().sessions;

        if (index < 0 || index >= sessions.length) {
          index = Math.min(sessions.length - 1, Math.max(0, index));
          set(() => ({ currentSessionIndex: index }));
        }

        const session = sessions[index];

        return session;
      },

      onNewMessage(message) {
        get().updateCurrentSession((session) => {
          session.lastUpdate = new Date().toLocaleString();
        });
        get().updateStat(message);
        // get().summarizeSession();
      },

      async onUserInput(content,id:string) {
        const userMessage: Message = {
          role: "user",
          content,
          date: new Date().toLocaleString(),
        };

        const botMessage: Message = {
          content: "",
          role: "assistant",
          date: new Date().toLocaleString(),
          streaming: true,
        };

        // get recent messages
        const recentMessages = get().getMessagesWithMemory();
        const sendMessages = recentMessages.concat(userMessage);

        // save user's and bot's message
        get().updateCurrentSession((session) => {
          session.messages.push(userMessage);
          session.messages.push(botMessage);
        });

        console.log("[User Input] ", sendMessages);
        requestChatStream(content,id,{
          onMessage(content, done) {
            if (done) {
              botMessage.streaming = false;
              get().onNewMessage(botMessage);
            } else {
              botMessage.content = content;
              set(() => ({}));
            }
          },
          onError(error) {
            botMessage.content += "\n\n" + Locale.Store.Error;
            set(() => ({}));
          },
          filterBot: !get().config.sendBotMessages,
        });
      },

      getMemoryPrompt() {
        const session = get().currentSession();

        return {
          role: "system",
          content: Locale.Store.Prompt.History(session.memoryPrompt),
          date: "",
        } as Message;
      },

      getMessagesWithMemory() {
        const session = get().currentSession();
        const config = get().config;
        const n = session.messages.length;
        const recentMessages = session.messages.slice(
          n - config.historyMessageCount
        );

        const memoryPrompt = get().getMemoryPrompt();

        if (session.memoryPrompt) {
          recentMessages.unshift(memoryPrompt);
        }

        return recentMessages;
      },

      updateMessage(
        sessionIndex: number,
        messageIndex: number,
        updater: (message?: Message) => void
      ) {
        const sessions = get().sessions;
        const session = sessions.at(sessionIndex);
        const messages = session?.messages;
        updater(messages?.at(messageIndex));
        set(() => ({ sessions }));
      },

      summarizeSession() {
        const session = get().currentSession();

        if (session.topic === DEFAULT_TOPIC && session.messages.length >= 3) {
          // should summarize topic
          requestWithPrompt(session.messages, Locale.Store.Prompt.Topic).then(
            (res) => {
              get().updateCurrentSession(
                (session) => (session.topic = trimTopic(res))
              );
            }
          );
        }

        const config = get().config;
        let toBeSummarizedMsgs = session.messages.slice(
          session.lastSummarizeIndex
        );
        const historyMsgLength = toBeSummarizedMsgs.reduce(
          (pre, cur) => pre + cur.content.length,
          0
        );

        if (historyMsgLength > 4000) {
          toBeSummarizedMsgs = toBeSummarizedMsgs.slice(
            -config.historyMessageCount
          );
        }

        // add memory prompt
        toBeSummarizedMsgs.unshift(get().getMemoryPrompt());

        const lastSummarizeIndex = session.messages.length;

        console.log(
          "[Chat History] ",
          toBeSummarizedMsgs,
          historyMsgLength,
          config.compressMessageLengthThreshold
        );

        if (historyMsgLength > config.compressMessageLengthThreshold) {
          // requestChatStream(
          //   toBeSummarizedMsgs.concat({
          //     role: "system",
          //     content: Locale.Store.Prompt.Summarize,
          //     date: "",
          //   }),
          //   {
          //     filterBot: false,
          //     onMessage(message, done) {
          //       session.memoryPrompt = message;
          //       if (done) {
          //         console.log("[Memory] ", session.memoryPrompt);
          //         session.lastSummarizeIndex = lastSummarizeIndex;
          //       }
          //     },
          //     onError(error) {
          //       console.error("[Summarize] ", error);
          //     },
          //   }
          // );
        }
      },

      updateStat(message) {
        get().updateCurrentSession((session) => {
          session.stat.charCount += message.content.length;
          // TODO: should update chat count and word count
        });
      },

      updateCurrentSession(updater) {
        const sessions = get().sessions;
        const index = get().currentSessionIndex;
        updater(sessions[index]);
        set(() => ({ sessions }));
      },

      clearAllData() {
        if (confirm(Locale.Store.ConfirmClearAll)) {
          localStorage.clear();
          location.reload();
        }
      },
    }),
    {
      name: LOCAL_KEY,
      version: 1,
    }
  )
);
