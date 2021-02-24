This is a WIP [Alt1](https://runeapps.org/alt1) app for transcribing [RuneScape](https://rs.game) dialogue in the [format](https://rs.wiki/RS:Style_guide/Transcripts) used by the [RuneScape Wiki](https://rs.wiki).

# Installing

This app must be run through Alt1. It will refuse to work if it isn't. Alt1 can be downloaded [here](https://runeapps.org).

Once you have installed Alt1, follow these steps to add this app to it:

1. Clone or download this repository.
1. If you downloaded it as a zip file, extract the files somewhere you'll remember.
1. Open Alt1, and open the Alt1 browser (by opening the Alt1 Toolkit menu, then clicking Browser)
1. Paste the local file path to the transcriber2.html file into the browser's address bar
1. Click the Add App button in the upper right corner.

# Using RSWikiTranscriber

1. Launch RSWikiTranscriber from Alt1.
1. Enter your name in the text area that says Player Name, if you want your name to be automatically replaced with the word Player. This will be saved in local storage across usages of this app.
1. Press Start
1. Talk to an NPC
1. When you're given dialogue options, make sure you click the corresponding button on the RSWikiTranscriber window. You can do this before *or* after clicking the option.
    * Alternatively, you can hover your mouse over a dialogue option and press Alt+1. You'll have to do this *before* clicking the option.
1. At any time, press Export to print the current state of the dialogue tree. 
    * This will happen automatically if the Auto-export dialogue checkbox is checked.
1. If you need to go through a dialogue multiple times, pressing Stop then Start again will allow you to try to combine several paths through a conversation into a single tree. 
    * The app will attempt to do this automatically, but if very similar dialogue (that is not actually a repeat) is encountered, it may overwrite parts of the dialogue tree.
1. Press Clear to completely clear the dialogue tree and start over.

The app only requires the "View screen" permission to function, but enabling the "Show overlay" permission lets the app show an overlay to which keeps track of which dialogue options you have selected in the past.
Currently, this overlay only lasts for up to about 20 seconds, due to limitations of the Alt1 overlay API.
