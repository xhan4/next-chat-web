"use client";

import { useState, useRef, useEffect } from "react";

import { IconButton } from "./button";
import styles from "./home.module.scss";

import LogoIcon from "../icons/logo.svg";
import SendWhiteIcon from "../icons/send-white.svg";
import BotIcon from "../icons/bot.svg";
import AddIcon from "../icons/add.svg";
import DeleteIcon from "../icons/delete.svg";
import LoadingIcon from "../icons/three-dots.svg";
import MenuIcon from "../icons/menu.svg";
import CloseIcon from "../icons/close.svg";

import { Message, SubmitKey, useChatStore } from "../store";
import {isIOS, selectOrCopy } from "../utils";
import Locale from "../locales";

import dynamic from "next/dynamic";
import React from "react";

export function Loading(props: { noLogo?: boolean }) {
  return (
    <div className={styles["loading-content"]}>
      {!props.noLogo && <BotIcon />}
      <LoadingIcon />
    </div>
  );
}

const Markdown = dynamic(async () => (await import("./markdown")).Markdown, {
  loading: () => <LoadingIcon />,
});

const Settings = dynamic(async () => (await import("./settings")).Settings, {
  loading: () => <Loading noLogo />,
});

const Emoji = dynamic(async () => (await import("emoji-picker-react")).Emoji, {
  loading: () => <LoadingIcon />,
});

export function Avatar(props: { role: Message["role"] }) {
  const config = useChatStore((state) => state.config);

  if (props.role === "assistant") {
    return <BotIcon className={styles["user-avtar"]} />;
  }

  return (
    <div className={styles["user-avtar"]}>
      <Emoji unified={config.avatar} size={18} />
    </div>
  );
}

export function ChatItem(props: {
  onClick?: () => void;
  onDelete?: () => void;
  title: string;
  count: number;
  time: string;
  selected: boolean;
}) {
  return (
    <div
      className={`${styles["chat-item"]} ${
        props.selected && styles["chat-item-selected"]
      }`}
      onClick={props.onClick}
    >
      <div className={styles["chat-item-title"]}>{props.title}</div>
      <div className={styles["chat-item-info"]}>
        <div className={styles["chat-item-count"]}>
          {Locale.ChatItem.ChatItemCount(props.count)}
        </div>
        <div className={styles["chat-item-date"]}>{props.time}</div>
      </div>
      <div className={styles["chat-item-delete"]} onClick={props.onDelete}>
        <DeleteIcon />
      </div>
    </div>
  );
}

export function ChatList() {
  const [sessions, selectedIndex, selectSession, removeSession] = useChatStore(
    (state) => [
      state.sessions,
      state.currentSessionIndex,
      state.selectSession,
      state.removeSession,
    ]
  );

  return (
    <div className={styles["chat-list"]}>
      {sessions.map((item, i) => (
        <ChatItem
          title={item.topic}
          time={item.lastUpdate}
          count={item.messages.length}
          key={i}
          selected={i === selectedIndex}
          onClick={() => selectSession(i)}
          onDelete={() => removeSession(i,sessions)}
        />
      ))}
    </div>
  );
}

function useSubmitHandler() {
  const config = useChatStore((state) => state.config);
  const submitKey = config.submitKey;

  const shouldSubmit = (e: KeyboardEvent) => {
    if (e.key !== "Enter") return false;

    return (
      (config.submitKey === SubmitKey.AltEnter && e.altKey) ||
      (config.submitKey === SubmitKey.CtrlEnter && e.ctrlKey) ||
      (config.submitKey === SubmitKey.ShiftEnter && e.shiftKey) ||
      config.submitKey === SubmitKey.Enter
    );
  };

  return {
    submitKey,
    shouldSubmit,
  };
}

export function Chat(props: { showSideBar?: () => void }) {
  type RenderMessage = Message & { preview?: boolean };

  const session = useChatStore((state) => state.currentSession());
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { submitKey, shouldSubmit } = useSubmitHandler();

  const onUserInput = useChatStore((state) => state.onUserInput);
  const onUserSubmit = () => {
    if (userInput.length <= 0) return;
    setIsLoading(true);
    onUserInput(userInput,session.id).then(() => setIsLoading(false));
    setUserInput("");
  };
  const onInputKeyDown = (e: KeyboardEvent) => {
    if (shouldSubmit(e)) {
      onUserSubmit();
      e.preventDefault();
    }
  };
  const latestMessageRef = useRef<HTMLDivElement>(null);

  const messages = (session?.messages as RenderMessage[])??[]
    .concat(
      isLoading
        ? [
            {
              role: "assistant",
              content: "……",
              date: new Date().toLocaleString(),
              preview: true,
            },
          ]
        : []
    )
    .concat(
      userInput.length > 0
        ? [
            {
              role: "user",
              content: userInput,
              date: new Date().toLocaleString(),
              preview: true,
            },
          ]
        : []
    );

  useEffect(() => {
    const dom = latestMessageRef.current;
    if (dom && !isIOS()) {
      dom.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }
  });
  return (
    <div className={styles.chat} key={session.id}>
      <div className={styles["window-header"]}>
        <div
          className={styles["window-header-title"]}
          onClick={props?.showSideBar}
        >
          <div className={styles["window-header-main-title"]}>
            {session.topic}
          </div>
          <div className={styles["window-header-sub-title"]}>
            {Locale.Chat.SubTitle(session.messages.length)}
          </div>
        </div>
        <div className={styles["window-actions"]}>
          <div className={styles["window-action-button"] + " " + styles.mobile}>
            <IconButton
              icon={<MenuIcon />}
              bordered
              title={Locale.Chat.Actions.ChatList}
              onClick={props?.showSideBar}
            />
          </div>
        </div>
      </div>

      <div className={styles["chat-body"]}>
        {messages.map((message, i) => {
          const isUser = message.role === "user";

          return (
            <div
              key={i}
              className={
                isUser ? styles["chat-message-user"] : styles["chat-message"]
              }
            >
              <div className={styles["chat-message-container"]}>
                <div className={styles["chat-message-avatar"]}>
                  <Avatar role={message.role} />
                </div>
                {(message.preview) && (
                  <div className={styles["chat-message-status"]}>
                    {Locale.Chat.Typing}
                  </div>
                )}
                <div className={styles["chat-message-item"]}>
                  {(message.preview || message.content.length === 0) &&
                  !isUser ? (
                    <LoadingIcon />
                  ) : (
                    <div
                      className="markdown-body"
                      onContextMenu={(e) => {
                        if (selectOrCopy(e.currentTarget, message.content)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      <Markdown content={message.content} />
                    </div>
                  )}
                </div>
                {!isUser && !message.preview && (
                  <div className={styles["chat-message-actions"]}>
                    <div className={styles["chat-message-action-date"]}>
                      {message.date.toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <span ref={latestMessageRef} style={{ opacity: 0 }}>
          -
        </span>
      </div>

      <div className={styles["chat-input-panel"]}>
        <div className={styles["chat-input-panel-inner"]}>
          <textarea
            className={styles["chat-input"]}
            placeholder={Locale.Chat.Input(submitKey)}
            rows={3}
            onInput={(e) => setUserInput(e.currentTarget.value)}
            value={userInput}
            onKeyDown={(e) => onInputKeyDown(e as any)}
          />
          <IconButton
            icon={<SendWhiteIcon />}
            text={Locale.Chat.Send}
            className={styles["chat-input-send"] + " no-dark"}
            onClick={onUserSubmit}
          />
        </div>
      </div>
    </div>
  );
}

function useSwitchTheme() {
  const config = useChatStore((state) => state.config);

  useEffect(() => {
    document.body.classList.remove("light");
    document.body.classList.remove("dark");
    if (config.theme === "dark") {
      document.body.classList.add("dark");
    } else if (config.theme === "light") {
      document.body.classList.add("light");
    }
  }, [config.theme]);
}

export function Home() {
  const [sessions,createNewSession, currentIndex, removeSession] = useChatStore(
    (state) => [
      state.sessions,
      state.newSession,
      state.currentSessionIndex,
      state.removeSession,
    ]
  );
  const loading = !useChatStore?.persist?.hasHydrated();
  const [showSideBar, setShowSideBar] = useState(true);

  // setting
  const [openSettings, setOpenSettings] = useState(false);
  const config = useChatStore((state) => state.config);

  useSwitchTheme();

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    if(sessions.length==0){
      useChatStore.getState().initializeStore()
    }
    setIsMounted(true);
  }, []);
  if (loading&&isMounted) {
    return <Loading />;
  }

  return (
    isMounted&&<div
      className={`${ 
        config.tightBorder ? styles["tight-container"] : styles.container
      }`}
    >
      <div
        className={styles.sidebar + ` ${showSideBar && styles["sidebar-show"]}`}
      >
        <div className={styles["sidebar-header"]}>
          <div className={styles["sidebar-title"]}>Gemma3 Next</div>
          <div className={styles["sidebar-sub-title"]}>
            Build your own AI assistant.
          </div>
          <div className={styles["sidebar-logo"]}>
            <LogoIcon />
          </div>
        </div>

        <div
          className={styles["sidebar-body"]}
          onClick={() => {
            setOpenSettings(false);
            setShowSideBar(false);
          }}
        >
          <ChatList />
        </div>

        <div className={styles["sidebar-tail"]}>
          <div className={styles["sidebar-actions"]}>
            <div className={styles["sidebar-action"] + " " + styles.mobile}>
              <IconButton
                icon={<CloseIcon />}
                onClick={() => {
                  if (confirm(Locale.Home.DeleteChat)) {
                    removeSession(currentIndex,sessions);
                  }
                }}
              />
            </div>
          </div>
          <div>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Home.NewChat}
              onClick={createNewSession}
            />
          </div>
        </div>
      </div>

      <div className={styles["window-content"]}>
        {openSettings ? (
          <Settings
            closeSettings={() => {
              setOpenSettings(false);
              setShowSideBar(true);
            }}
          />
        ) : (
          sessions.length>0&&<Chat key="chat" showSideBar={() => setShowSideBar(true)} />
        )}
      </div>
    </div>
  );
}
