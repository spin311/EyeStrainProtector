let notifTime: number = 5;

document.addEventListener('DOMContentLoaded', async function (): Promise<void> {
    const autoAudio: HTMLInputElement = document.getElementById('autoAudio') as HTMLInputElement;
    const selectAudio: HTMLSelectElement = document.getElementById('selectAudio') as HTMLSelectElement;
    const playAudio: HTMLButtonElement = document.getElementById('playAudio') as HTMLButtonElement;
    const toggleActive: HTMLButtonElement = document.getElementById('toggleActive') as HTMLButtonElement;
    const showNotification: HTMLInputElement = document.getElementById('showNotification') as HTMLInputElement;
    const volume: HTMLInputElement = document.getElementById('volume') as HTMLInputElement;
    const reminderTime: HTMLInputElement = document.getElementById('reminderTime') as HTMLInputElement;
    const snoozeTime: HTMLInputElement = document.getElementById('snoozeTime') as HTMLInputElement;
    const notificationTime: HTMLInputElement = document.getElementById('notificationTime') as HTMLInputElement;
    if (autoAudio) {
        await setAudioCheckbox(autoAudio);
    }

    if(selectAudio) {
        await setAudioOption(selectAudio);
    }

    if(showNotification) {
        await setShowNotification(showNotification);
    }

    if (volume) {
        await setVolume(volume);
    }

    if (reminderTime) {
        chrome.storage.sync.get('reminderTime', function (result) {
            if (result.reminderTime) {
                reminderTime.value = result.reminderTime;
            }
        });
        reminderTime.addEventListener('change', function () {
            chrome.storage.sync.set({ 'reminderTime': reminderTime.value });
        });
    }
    if (snoozeTime) {
        chrome.storage.sync.get('snoozeTime', function (result) {
            if (result.snoozeTime) {
                snoozeTime.value = result.snoozeTime;
            }
        });
        snoozeTime.addEventListener('change', function () {
            chrome.storage.sync.set({ 'snoozeTime': snoozeTime.value });
        });
    }

    if (notificationTime) {
        chrome.storage.sync.get('notificationTime', function (result) {
            if (result.notificationTime) {
                notifTime = result.notificationTime;
                notificationTime.value = result.notificationTime;
            }
        });
        notificationTime.addEventListener('change', function () {
            notifTime = Number(notificationTime.value);
            chrome.storage.sync.set({ 'notificationTime': notifTime });
        });
    }
    if (toggleActive) {
        const result = await chrome.storage.sync.get('active');
        if (!result['active']) {
            toggleActive.classList.add('off');
        }
        else {
            toggleActive.classList.remove('off');
        }
        toggleActive.addEventListener('click', async function () {
            const result = await chrome.storage.sync.get('active');
            const active = result['active'];
            await chrome.storage.sync.set({ 'active': !active });
            toggleActive.classList.toggle('off');
            await chrome.runtime.sendMessage({
                type: 'toggle-active',
                target: 'background',
                data: !active
            });
        });
    }

    if(playAudio) {
        playAudio.addEventListener('click', testAlert);
    }
});


function disableButtonForAudioDuration() {
    const playAudio: HTMLButtonElement = document.getElementById('playAudio') as HTMLButtonElement;
    playAudio.disabled = true;
    playAudio.classList.remove('btn-success');
    playAudio.classList.add('btn-fail');
    setTimeout(() => {
        playAudio.disabled = false;
        playAudio.classList.remove('btn-fail');
        playAudio.classList.add('btn-success');
    }, notifTime * 5000);
}

async function testAlert(): Promise<void> {
    await chrome.runtime.sendMessage({
        type: 'play-sound',
        target: 'background',
    });
    await chrome.runtime.sendMessage({
        type: 'show-notification',
        target: 'background',
    });
    disableButtonForAudioDuration();
}

async function setVolume(volume: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get('volume');
    const vol = result['volume'];
    if (vol !== undefined) {
        volume.value =  String(vol);
    }
    volume.addEventListener('change', async function (): Promise<void> {
        await chrome.storage.sync.set({['volume']: parseFloat(volume.value)});
    });

}

async function setAudioOption(selectAudio: HTMLSelectElement): Promise<void> {
    const result = await chrome.storage.sync.get('audio');
    selectAudio.value = result['audio'];
    selectAudio.addEventListener('change', async function (): Promise<void> {
        await chrome.storage.sync.set({['audio']: selectAudio.value});
    });
}

async function setAudioCheckbox(autoAudio: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get('audioActive');
    autoAudio.checked = result['audioActive'];
    autoAudio.addEventListener('click', async function (): Promise<void> {
        await chrome.storage.sync.set({['audioActive']: autoAudio.checked});
    });
}

async function setShowNotification(showNotification: HTMLInputElement): Promise<void> {
    const result = await chrome.storage.sync.get('showNotification');
    showNotification.checked = result['showNotification'];
    showNotification.addEventListener('click', async function (): Promise<void> {
        await chrome.storage.sync.set({['showNotification']: showNotification.checked});
    });
}
