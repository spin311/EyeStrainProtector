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
const ICON_URL = 'imgs/icon.png';
const TITLE = 'Time to rest your eyes!';
const MESSAGE = 'Look away from the screen and focus on something 20 meters away for the duration of this notification. (20s)';
let creating; // A global promise to avoid concurrency issues
let docExists = false;
let notificationEnabled = true;
let audioEnabled = true;
chrome.runtime.onMessage.addListener(handleMessages);
function handleMessages(message) {
    return __awaiter(this, void 0, void 0, function* () {
        switch (message.type) {
            case 'update-audio':
                audioEnabled = message.data;
                checkAndCreateAlarm();
                break;
            case 'update-notifications':
                notificationEnabled = message.data;
                checkAndCreateAlarm();
                break;
        }
    });
}
chrome.runtime.onInstalled.addListener((details) => __awaiter(void 0, void 0, void 0, function* () {
    if (details.reason === "install") {
        console.log('Installed');
        yield setInitialValues();
        yield new Promise(resolve => setTimeout(resolve, 1000));
        yield chrome.tabs.create({ url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true });
    }
}));
function checkAndCreateAlarm() {
    if (!notificationEnabled && !audioEnabled)
        return;
    chrome.alarms.get('eyeRestAlarm', (alarm) => {
        if (!alarm) {
            // Create an alarm that fires every 20 minutes
            chrome.alarms.create('eyeRestAlarm', { periodInMinutes: 1 }).then(() => {
                chrome.alarms.onAlarm.addListener(() => __awaiter(this, void 0, void 0, function* () {
                    if (notificationEnabled)
                        sendNotification();
                    if (audioEnabled)
                        yield playAudio();
                }));
            });
            // Listen for when the alarm fires
        }
    });
}
chrome.runtime.onStartup.addListener(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Startup');
    if (!docExists) {
        yield setupOffscreenDocument('offscreen.html');
    }
    chrome.storage.sync.get([AUDIO_ACTIVE, SHOW_NOTIFICATION], (result) => {
        console.log(result);
        notificationEnabled = result[SHOW_NOTIFICATION];
        audioEnabled = result[AUDIO_ACTIVE];
        checkAndCreateAlarm();
    });
}));
function setInitialValues() {
    return __awaiter(this, void 0, void 0, function* () {
        yield Promise.all([
            chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
            chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
            chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
        ]);
    });
}
function playAudio() {
    return __awaiter(this, arguments, void 0, function* (audio = 'alert1.mp3', volume = 1.0) {
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
function sendNotification() {
    console.log('Sending Notification');
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL(ICON_URL),
        title: TITLE,
        message: MESSAGE
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.log(`Notification Error: ${chrome.runtime.lastError.message}`);
        }
        else {
            console.log(`Notification created with ID: ${notificationId}`);
            setTimeout(() => {
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    if (wasCleared) {
                        console.log(`Notification with ID: ${notificationId} was cleared.`);
                    }
                    else if (chrome.runtime.lastError) {
                        console.log(`Notification Clear Error: ${chrome.runtime.lastError.message}`);
                    }
                });
            }, 20000);
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
                justification: 'Notification'
            });
            yield creating;
            creating = null;
            docExists = true;
        }
    });
}
