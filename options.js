document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('saveBtn').addEventListener('click', saveOptions);

function saveOptions() {
    const annualSalary = document.getElementById('annualSalary').value;
    const startTime = document.getElementById('startTime').value;

    chrome.storage.sync.set({
        annualSalary: annualSalary || 100000,
        startTime: startTime || '09:00'
    }, function() {
        // Update status to let user know options were saved.
        const status = document.getElementById('status');
        status.style.opacity = '1';
        setTimeout(function() {
            status.style.opacity = '0';
        }, 2000);
    });
}

function restoreOptions() {
    chrome.storage.sync.get({
        annualSalary: 100000,
        startTime: '09:00'
    }, function(items) {
        document.getElementById('annualSalary').value = items.annualSalary;
        document.getElementById('startTime').value = items.startTime;
    });
}
