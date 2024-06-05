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
const NOTIFICATION_TIME = 'notificationTime';
const SNOOZE_TIME = 'snoozeTime';
const REST_ALARM = 'restAlarm';
const SNOOZE_ALARM = 'snoozeAlarm';
const REMINDER_TIME = 'reminderTime';
let creating; // A global promise to avoid concurrency issues
let docExists = false;
let volume;
let audio;
let shouldSendNotification;
let shouldPlayAudio;
let minutesTimer = 20;
let snoozeTime;
let notificationClosed = false;
let notificationCount;
function snoozeNotification() {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.alarms.clearAll();
        yield chrome.alarms.create(SNOOZE_ALARM, { delayInMinutes: snoozeTime });
    });
}
chrome.runtime.onMessage.addListener(handleMessages);
chrome.notifications.onClicked.addListener((notificationId) => {
    notificationClosed = true;
});
chrome.notifications.onButtonClicked.addListener((_notificationId, buttonIndex) => __awaiter(void 0, void 0, void 0, function* () {
    notificationClosed = true;
    if (buttonIndex === 0) {
        yield snoozeNotification();
    }
}));
chrome.runtime.onInstalled.addListener((details) => __awaiter(void 0, void 0, void 0, function* () {
    yield chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    if (details.reason === "install") {
        yield setInitialValues();
        yield new Promise(resolve => setTimeout(resolve, 1000));
        yield chrome.tabs.create({ url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true });
    }
}));
chrome.runtime.onStartup.addListener(function () {
    return __awaiter(this, void 0, void 0, function* () {
        minutesTimer = yield getMinutesTimer();
        yield chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    });
});
chrome.storage.onChanged.addListener((changes, areaName) => __awaiter(void 0, void 0, void 0, function* () {
    if (areaName === 'sync') {
        for (let key in changes) {
            const storageChange = changes[key];
            switch (key) {
                case SNOOZE_TIME:
                    snoozeTime = Number(storageChange.newValue);
                    break;
                case REMINDER_TIME:
                    minutesTimer = Number(storageChange.newValue);
                    yield chrome.alarms.clearAll();
                    yield chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
                    break;
                case AUDIO:
                    audio = String(storageChange.newValue);
                    break;
                case VOLUME:
                    volume = Number(storageChange.newValue) / 100;
                    break;
                case AUDIO_ACTIVE:
                    shouldPlayAudio = Boolean(storageChange.newValue);
                    break;
                case SHOW_NOTIFICATION:
                    shouldSendNotification = Boolean(storageChange.newValue);
                    break;
                case NOTIFICATION_TIME:
                    notificationCount = Number(storageChange.newValue);
                    break;
            }
        }
    }
}));
function getSnoozeMessage(duration) {
    return `Snooze (${duration}min) `;
}
function getMinutesTimer() {
    return __awaiter(this, void 0, void 0, function* () {
        return yield new Promise((resolve) => {
            chrome.storage.sync.get(REMINDER_TIME, function (result) {
                resolve(result[REMINDER_TIME] || 20);
            });
        });
    });
}
function toggleActive(active) {
    return __awaiter(this, void 0, void 0, function* () {
        yield chrome.alarms.clearAll();
        if (active) {
            minutesTimer = yield getMinutesTimer();
            yield chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
        }
    });
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
                yield sendNotification();
                break;
            case 'toggle-active':
                yield toggleActive(message.data);
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
    if (alarm.name === SNOOZE_ALARM) {
        handleAlarmActions();
        yield chrome.alarms.clear(SNOOZE_ALARM);
        yield chrome.alarms.create(REST_ALARM, { periodInMinutes: minutesTimer });
    }
    else if (alarm.name === REST_ALARM) {
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
            chrome.storage.sync.set({ [NOTIFICATION_TIME]: 4 }),
            chrome.storage.sync.set({ [SNOOZE_TIME]: 5 }),
            chrome.storage.sync.set({ REMINDER_TIME: 20 }),
            chrome.storage.sync.set({ 'active': true })
        ]);
    });
}
function getMessage(duration) {
    return `Time to rest your eyes! Look away at something 20 meters away for duration of this message (${duration}s)`;
}
function getNotificationCount() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(NOTIFICATION_TIME, function (result) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                else {
                    resolve(result[NOTIFICATION_TIME] || 4);
                }
            });
        });
    });
}
function getSnoozeTime() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(SNOOZE_TIME, function (result) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                else {
                    resolve(result[SNOOZE_TIME] || 5);
                }
            });
        });
    });
}
function sendNotification() {
    return __awaiter(this, void 0, void 0, function* () {
        const iconUrl = chrome.runtime.getURL(ICON_URL);
        if (!notificationCount) {
            notificationCount = yield getNotificationCount();
        }
        if (!snoozeTime) {
            snoozeTime = yield getSnoozeTime();
        }
        let duration = notificationCount * 5;
        notificationClosed = false;
        for (let i = 0; i < notificationCount; i++) {
            if (notificationClosed) {
                break;
            }
            yield new Promise((resolve) => {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: iconUrl,
                    title: TITLE,
                    buttons: [{ title: getSnoozeMessage(snoozeTime) }, { title: 'Close' }],
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
