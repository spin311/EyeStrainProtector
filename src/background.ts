import Reason = chrome.offscreen.Reason;
import ContextType = chrome.runtime.ContextType;

const AUDIO_ACTIVE = "audioActive";
const SHOW_NOTIFICATION = "showNotification";
const AUDIO = "audio";
const ICON_URL = 'imgs/icon.png';
const TITLE = 'Time to rest your eyes!';
const MESSAGE = 'Look away from the screen and focus on something 20 meters away for the duration of this notification. (20s)';
let creating: Promise<void> | null; // A global promise to avoid concurrency issues
let docExists: boolean = false;
let notificationEnabled: boolean = true;
let audioEnabled: boolean = true;

chrome.runtime.onMessage.addListener(handleMessages);

async function handleMessages(message: { type: any; data: boolean; }): Promise<void> {
    switch (message.type) {
        case 'update-audio':
            audioEnabled = message.data;
            checkAndCreateAlarm();
            break;
        case 'update-notifications':
            sendNotification();
            notificationEnabled = message.data;
            checkAndCreateAlarm();
            break;
    }
}

chrome.runtime.onInstalled.addListener(async (details: { reason: string; }): Promise<void> => {
    if(details.reason === "install"){
        console.log('Installed');
        await setInitialValues();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await chrome.tabs.create({url: "https://spin311.github.io/ProlificStudiesGoogle/", active: true});
    }
});

function checkAndCreateAlarm(): void {
    if (!notificationEnabled && !audioEnabled) return;
    chrome.alarms.get('eyeRestAlarm', (alarm) => {
        if (!alarm) {
            // Create an alarm that fires every 20 minutes
            chrome.alarms.create('eyeRestAlarm', {periodInMinutes: 20}).then(() => {
                    chrome.alarms.onAlarm.addListener(async () => {
                        if (notificationEnabled) sendNotification();
                        if (audioEnabled) await playAudio();
                    });
                }
            );
            // Listen for when the alarm fires

        }
    });
}

chrome.runtime.onStartup.addListener(async () =>{
    console.log('Startup');
    if (!docExists) {
        await setupOffscreenDocument('offscreen.html');
    }
    chrome.storage.sync.get([AUDIO_ACTIVE, SHOW_NOTIFICATION], (result) => {
        console.log(result);
        notificationEnabled = result[SHOW_NOTIFICATION];
        audioEnabled = result[AUDIO_ACTIVE];
        checkAndCreateAlarm();

    });
});


async function setInitialValues(): Promise<void> {
    await Promise.all([
        chrome.storage.sync.set({ [AUDIO_ACTIVE]: true }),
        chrome.storage.sync.set({ [AUDIO]: "alert1.mp3" }),
        chrome.storage.sync.set({ [SHOW_NOTIFICATION]: true }),
    ]);

}

async function playAudio(audio:string='alert1.mp3',volume: number = 1.0) {
    const req = {
        audio: audio,
        volume: volume
    };
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'offscreen-doc',
        data: req
    });
}

function sendNotification(): void {
    console.log('Sending Notification');
    chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL(ICON_URL),
        title: TITLE,
        message: MESSAGE
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.log(`Notification Error: ${chrome.runtime.lastError.message}`);
        } else {
            console.log(`Notification created with ID: ${notificationId}`);
            setTimeout(() => {
                chrome.notifications.clear(notificationId, (wasCleared) => {
                    if (wasCleared) {
                        console.log(`Notification with ID: ${notificationId} was cleared.`);
                    } else if (chrome.runtime.lastError) {
                        console.log(`Notification Clear Error: ${chrome.runtime.lastError.message}`);
                    }
                });
            }, 20000);
        }
    });
}

async function setupOffscreenDocument(path: string): Promise<void> {
    // Check all windows controlled by the service worker to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl = chrome.runtime.getURL(path);
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: [ContextType.OFFSCREEN_DOCUMENT],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        docExists = true;
        return;
    }
    if (creating) {
        await creating;
    } else {
        creating = chrome.offscreen.createDocument({
            url: path,
            reasons: [Reason.AUDIO_PLAYBACK],
            justification: 'Notification'
        });
        await creating;
        creating = null;
        docExists = true;
    }
}
