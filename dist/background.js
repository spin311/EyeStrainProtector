"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var Reason = chrome.offscreen.Reason;
var ContextType = chrome.runtime.ContextType;
const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const AUDIO = "audio";
const VOLUME = "volume";
const ICON_URL = 'imgs/icon.png';
const TITLE = 'Preserve vision';
let creating; // A global promise to avoid concurrency issues
let docExists = false;
let volume;
let audio;
let shouldSendNotification;
let shouldPlayAudio;
let minutesTimer = 20;
let notificationClosed = false;
chrome.notifications.onClicked.addListener((notificationId) => {
    notificationClosed = true;
});
function snoozeNotification() {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.alarms.clearAll();
        yield chrome.alarms.create('snoozeAlarm', { delayInMinutes: 5 });
    });
}
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => __awaiter(void 0, void 0, void 0, function* () {
    notificationClosed = true;
    if (buttonIndex === 0) {
        yield snoozeNotification();
    }
}));
chrome.notifications.onClosed.addListener((notificationId, byUser) => {
    notificationClosed = true;
});
chrome.runtime.onMessage.addListener(handleMessages);
chrome.alarms.create('restAlarm', { periodInMinutes: minutesTimer });
chrome.runtime.onInstalled.addListener((details) => __awaiter(void 0, void 0, void 0, function* () {
    chrome.runtime.onMessage.addListener(handleMessages);
    if (details.reason === "install") {
        yield setInitialValues();
        yield new Promise(resolve => setTimeout(resolve, 1000));
        yield chrome.tabs.create({ url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true });
    }
}));
chrome.runtime.onStartup.addListener(function () {
    chrome.runtime.onMessage.addListener(handleMessages);
});
function getMessage(duration) {
    return `Time to rest your eyes! Look away at something 20 meters away for duration of this message (${duration}s)`;
}
function handleMessages(message) {
    return __awaiter(this, void 0, void 0, function* () {
        // Return early if this message isn't meant for the offscreen document.
        if (message.target !== 'background') {
            return;
        }
        // Dispatch the message to an appropriate handler.
        switch (message.type) {
            case 'play-sound':
                if (audio && volume) {
                    yield playAudio(audio, volume);
                }
                else {
                    chrome.storage.sync.get([AUDIO, VOLUME], function (result) {
                        if (result) {
                            audio = result[AUDIO];
                            volume = result[VOLUME] / 100;
                            if (audio && volume) {
                                playAudio(audio, volume);
                            }
                        }
                    });
                }
                break;
            case 'show-notification':
                sendNotification();
                break;
            case 'audio-changed':
                audio = message.data;
                break;
            case 'volume-changed':
                volume = message.data;
                break;
            case 'showNotification-changed':
                shouldSendNotification = message.data;
                break;
            case 'audioActive-changed':
                shouldPlayAudio = message.data;
                break;
        }
    });
}
function playAudio() {
    return __awaiter(this, arguments, void 0, function* (audio = 'alert1.mp3', volume = 1.0) {
        yield setupOffscreenDocument('audio/audio.html');
        const req = {
            audio: audio,
            volume: volume
        };
        yield chrome.runtime.sendMessage({
            type: 'play-sound',
            target: 'offscreen-doc',
            data: req
        });
    });
}
function handleAlarmActions() {
    if (shouldSendNotification) {
        sendNotification();
    }
    else {
        chrome.storage.sync.get(SHOW_NOTIFICATION, function (result) {
            if (result) {
                shouldSendNotification = result[SHOW_NOTIFICATION];
                if (shouldSendNotification) {
                    sendNotification();
                }
            }
        });
    }
    if (shouldPlayAudio && audio && volume) {
        playAudio(audio, volume);
    }
    else {
        chrome.storage.sync.get([AUDIO_ACTIVE, VOLUME, AUDIO], function (result) {
            if (result) {
                shouldPlayAudio = result[AUDIO_ACTIVE];
                volume = result[VOLUME] / 100;
                audio = result[AUDIO];
                if (shouldPlayAudio && audio && volume) {
                    playAudio(audio, volume);
                }
            }
        });
    }
}
chrome.alarms.onAlarm.addListener((alarm) => __awaiter(void 0, void 0, void 0, function* () {
    if (alarm.name === 'snoozeAlarm') {
        handleAlarmActions();
        yield chrome.alarms.clear('snoozeAlarm');
        yield chrome.alarms.create('restAlarm', { periodInMinutes: minutesTimer });
    }
    else if (alarm.name === 'restAlarm') {
        handleAlarmActions();
    }
}));
function setInitialValues() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
            chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
            chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
            chrome.storage.sync.set({ [VOLUME]: 100 }),
        ]);
    });
}
function sendNotification() {
    return __awaiter(this, void 0, void 0, function* () {
        const iconUrl = chrome.runtime.getURL(ICON_URL);
        let duration = 20;
        notificationClosed = false;
        for (let i = 0; i < 4; i++) {
            if (notificationClosed) {
                break;
            }
            yield new Promise((resolve) => {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: iconUrl,
                    title: TITLE,
                    buttons: [{ title: 'Snooze (5min)' }, { title: 'Close' }],
                    message: getMessage(duration)
                }, function (notificationId) {
                    setTimeout(() => {
                        chrome.notifications.clear(notificationId);
                        duration -= 5;
                        resolve(null);
                    }, 5000);
                });
            });
        }
    });
}
function setupOffscreenDocument(path) {
    return __awaiter(this, void 0, void 0, function* () {
        // Check all windows controlled by the service worker to see if one
        // of them is the offscreen document with the given path
        const offscreenUrl = chrome.runtime.getURL(path);
        const existingContexts = yield chrome.runtime.getContexts({
            contextTypes: [ContextType.OFFSCREEN_DOCUMENT],
            documentUrls: [offscreenUrl]
        });
        if (existingContexts.length > 0) {
            docExists = true;
            return;
        }
        if (creating) {
            yield creating;
        }
        else {
            creating = chrome.offscreen.createDocument({
                url: path,
                reasons: [Reason.AUDIO_PLAYBACK],
                justification: 'Audio playback'
            });
            yield creating;
            creating = null;
            docExists = true;
        }
    });
}
