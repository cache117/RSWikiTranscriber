// alt1 base libs, provides all the commonly used methods for image matching and capture
// also gives your editor info about the window.alt1 api
import * as a1lib from "alt1";
import DialogReader, { DialogButton } from "alt1/dialog";
import * as uuid from "uuid-random";

// tell webpack that this file relies index.html, appconfig.json and icon.png, this makes webpack
// add these files to the output directory
// this works because in /webpack.config.js we told webpack to treat all html, json and imageimports
// as assets
import "./index.html";
import Queue from "./Queue.js";
import "./appconfig.json";
import "./RSWikiIcon.png";

// Define an extended interface for DialogButton
interface DialogOptions extends DialogButton {
    next?: DialogTree | null;
}

// Type definition for DialogTree
type DialogReaderReturnObject = {
    text: string[] | null;
    opts: ReturnType<InstanceType<typeof DialogReader>["readOptions"]> | null;
    title: string;
};

type DialogTree = DialogReaderReturnObject & {
    parents?: DialogTree[] | null;
    anchor?: string | null;
    next?: DialogTree | null;
	opts?: DialogOptions[] | null;
};

const dialogReader: DialogReader = new DialogReader();
var dialogTree: DialogTree | null = null;
var currentChild: DialogTree | null = null;
var lastRead: DialogTree | null = null;

// Cache S. Issue-9 - 12/05/2023 - Add ability to repeat the speaker's name for each dialog box
var repeatSpeaker: boolean;
window.addEventListener("DOMContentLoaded", function() {
	var output: HTMLElement = document.getElementById("output");

	if (window.alt1) {
		//tell alt1 about the app
		//this makes alt1 show the add app button when running inside the embedded browser
		//also updates app settings if they are changed
		alt1.identifyAppUrl("./appconfig.json");
		
		stopAndClear();
		document.getElementById("clear").onclick = stopAndClear;
		document.getElementById("export").onclick = exportTree;
		document.getElementById("debug").onclick = function() {
			console.log("dialogReader", dialogReader);
			console.log("dialogTree", dialogTree);
			console.log("currentChild", currentChild);
			console.log("lastRead", lastRead);
		}
		playerInputField = (document.getElementById("playername") as HTMLInputElement);
		playerInputField.value = getSavedPlayerName();
		playerInputField.addEventListener("change", savePlayerName);
		document.getElementById("use-custom-indent").addEventListener("change", function(evt) {
			(document.getElementById("custom-indent") as HTMLInputElement).disabled = !(evt.target as HTMLInputElement).checked;
		});
		// Begin Cache S. Issue-9 12/05/2023 -- Add ability to repeat the speaker's name for each dialog box
		repeatSpeaker = (document.getElementById("repeat-speaker") as HTMLInputElement).checked;
		document.getElementById("repeat-speaker").addEventListener("change", function(evt) {
			repeatSpeaker = !(evt.target as HTMLInputElement).checked;
		});
		// End Cache S. Issue-9
		
		a1lib.on('alt1pressed', eventSelect);
	} else {
		let addappurl: string = `alt1://addapp/${new URL("./appconfig.json", document.location.href).href}`;
		output.insertAdjacentHTML("beforeend", `
			Alt1 not detected, click <a href='${addappurl}'>here</a> to add this app to Alt1
		`);
	}
});

var interval = null;
function startTranscribe(): void {
	let welcomeText: HTMLElement = document.getElementById("welcome");
	welcomeText.style.display = "none";
	let startButton: HTMLElement = document.getElementById("start-stop");
	startButton.onclick = stopTranscribe;
	startButton.innerText = "Stop";
	interval = setInterval(spacebar, 400);
}

function stopTranscribe(): void {
	let stopButton: HTMLElement = document.getElementById("start-stop");
	stopButton.onclick = startTranscribe;
	stopButton.innerText = "Start";
	clearInterval(interval);
	interval = null;
	setupOpts(null);
	currentChild = dialogTree;
}

/**
* Stops the transcribing and also clears the dialog tree.
*/
function stopAndClear(): void {
	stopTranscribe();
	clear();
	// What exactly did you expect?
}

/**
* Clears the dialog tree.
*/
function clear(): void {
	dialogTree = null;
	currentChild = dialogTree;
	lastRead = null;
	document.getElementById("output").innerText = "";
}

/**
* Exports the generated dialog tree to a text format.
* Write it to a dedicated output area.
*/
function exportTree(): void {
	let initialIndent: number = 1;
	if ((document.getElementById("use-custom-indent") as HTMLInputElement).checked) {
		initialIndent = parseInt((document.getElementById("custom-indent") as HTMLInputElement).value, 10);
	}
	
	document.getElementById("output").innerText = stringify(dialogTree, initialIndent, null);
}


/**
* Runs every 400ms, adding any dialog boxes it finds to the tree.
* If it finds an option box, it stops itself from looping, and sets up buttons to pick an option.
* These buttons delegate to the select() function.
*/
function spacebar(): void {
	let image: a1lib.ImgRef | null = null;
	let hasDialog: boolean = false;
	const readSomeDialog = function(): void {
		if (!hasDialog && dialogReader.pos) {
			hasDialog = readDialog();
		}
	}
	
	readSomeDialog();
	if (!hasDialog) {
		image = image || a1lib.captureHoldFullRs();
		if (!dialogReader.pos) {
			dialogReader.find(image);
		}
		if (dialogReader.pos) {
			//For debugging console.log('Dialog position set', dialogReader.pos);
		}
		readSomeDialog();
	}
}

function readDialog(): boolean {
	let image = a1lib.captureHoldFullRs();
	let foundBox = dialogReader.find(image);

	if (!foundBox) return false;
	let readInitial: DialogReaderReturnObject | boolean = dialogReader.read(image);
	if (!readInitial) return false;
	if (!isNewRead(readInitial)) return true;
	let read: DialogTree = {
		...readInitial,
		parents: null,
		anchor: null,
		next: null,
	};
	lastRead = read;
	
	if (isOpts(read)) {
		clearInterval(interval);
		interval = null;	
	}

	let continuingFromOld: boolean = false;
	let equalNode: DialogTree;
	if (currentChild) {
		if (areTheSame(currentChild, read)) {
			// Keep things in sync after restarts.
			return true;
			//return;
		}
		if (currentChild.next) {
			// We've been here before
			if (areTheSame(read, currentChild.next)) {
				currentChild = currentChild.next;
				setupOpts(currentChild.opts);
				if ((document.getElementById("auto-export") as HTMLInputElement).checked) {
					exportTree();
				}
				return true;
				//return;
			} else {
				// We're probably dealing with random/conditional dialog
				// TODO: Deal with that in a reasonable manner
				// (for now, we just ignore the old dialog in favour of the new)
				
				// (by which I mean we fall through to the code we'd've ended up in
				//  had currentChild.next not been set)
			}
		}
		equalNode = findEqualNode(read);
		if (equalNode) {
			currentChild.next = equalNode;
			equalNode.parents.push(currentChild);
			if (!equalNode.anchor) {
				equalNode.anchor = uuid();
			}
		} else {
			currentChild.next = read;
			read.parents = [currentChild];
		}
	}

	if (equalNode) {
		currentChild = equalNode;
		if (!equalNode.anchor) {
			equalNode.anchor = uuid();
		}
	} else {
		currentChild = read;
	}
	setupOpts(currentChild.opts);
	if (!dialogTree) {
		currentChild.parents = [null];
		dialogTree = currentChild;
	}
	if ((document.getElementById("auto-export")  as HTMLInputElement).checked) {
		exportTree();
	}
	return true;
}

/**
* Pressing one of the option buttons fires this function, causing the resulting dialog to be
* appended to the proper option in the tree.
* Runs every 400ms until a new box is found, and restarts the spacebar() loop unless that
* box is another options box.
*/
function select(index: number): boolean {
	if (interval == null) {
		interval = setInterval(function() {
			select(index);
		}, 400);
	}
	let image = a1lib.captureHoldFullRs();
	let foundBox = dialogReader.find(image);

	if (!foundBox) return false;

	let readInitial: DialogReaderReturnObject | boolean = dialogReader.read(image);
	if (!readInitial) return false;
	if (!isNewRead(readInitial)) return false;
	let read: DialogTree = {
		...readInitial,
		parents: null,
		anchor: null,
		next: null,
	};
	lastRead = read;
	
	clearInterval(interval);
	interval = null;
	
	if (!isOpts(read)) {
		interval = setInterval(spacebar, 400);
	}
	read.parents = [currentChild];

	let equalNode: DialogTree = findEqualNode(read);
	if (currentChild.opts[index].next) {
		// We've been here before
		if (areTheSame(read, currentChild.opts[index].next)) {
			currentChild = currentChild.opts[index].next;
			setupOpts(currentChild.opts);
			if ((document.getElementById("auto-export")  as HTMLInputElement).checked) {
				exportTree();
			}
			return true;
		} else {
			// We're probably dealing with random/conditional dialog
			// TODO: Deal with that in a reasonable manner
			// (for now, we just ignore the old dialog in favour of the new)

			// (by which I mean we fall through to the code we'd've ended up in
			//  had currentChild.opts[index].next not been set)
		}
	}

	if (equalNode) {
		currentChild.opts[index].next = equalNode;
		equalNode.parents.push(currentChild);

		currentChild = equalNode;
	} else {
		currentChild.opts[index].next = read;
		read.parents = [currentChild];
	
		currentChild = read;
	}
	setupOpts(currentChild.opts);
	if ((document.getElementById("auto-export")  as HTMLInputElement).checked) {
		exportTree();
	}
	return true;
}

function isNewRead(read: DialogTree): boolean {
	// If there was no last read, any read is a new one
	if (lastRead == null && read != null) {
		return true;
	}

	// If one has text but not the other, the read is new
	if ((lastRead.text == null) != (read.text == null)) return true;

	// If both have texts...
	if (lastRead.text && read.text) {
		// ...the read is new iff the texts are different
		if (lastRead.text.length != read.text.length) return true;
		for (let i: number = 0; i < read.text.length; ++i) {
			if (lastRead.text[i] != read.text[i]) return true;
		}
		return false;
	}

	// If we get here, neither has text. Thus both are options.
	if (read.opts.length != lastRead.opts.length) return true;
	for (let i: number = 0; i < read.opts.length; ++i) {
		if (lastRead.opts[i].text != read.opts[i].text) return true;
	}
	return false;
}

/**
* Given a list of dialog options, replaces any existing dialog option buttons with buttons
* matching the options in the list. 
* If the Overlay permission has been granted, also shows an icon by the dialog options
* indicating whether they've been visited in the past, and whether they've been selected.

* The supplied list may be empty, or null, or undefined.
* In that case, the buttons are simply removed and any overlays are cleared.
*/
function setupOpts(opts: DialogOptions[] | null) {
	// Set up buttons
	let optButtonField: HTMLElement = document.getElementById("options");
	let optButtons = optButtonField.getElementsByClassName("select-button");
	for (let i: number = optButtons.length - 1; i >= 0; --i) {
		optButtonField.removeChild(optButtons[i]);
	}
	if (window.alt1.permissionOverlay) {
		window.alt1.overLayClearGroup("RSWT");
	}
	if (!opts) return;
	for (let i: number = 0; i < opts.length; ++i) {
		let button: HTMLElement = document.createElement("DIV");
		button.classList.add("nisbutton");
		button.classList.add("select-button");
		button.onclick = makeOptButtonCallback(i);
		button.innerText = opts[i].text;
		optButtonField.appendChild(button);
	}

	// Set up overlays
	if (window.alt1.permissionOverlay) {
		window.alt1.overLaySetGroup("RSWT");
		for (let i: number = 0; i < opts.length; ++i) {
			let color: number;
			if (opts[i].next) {
				color = a1lib.mixColor(0, 255, 0);
			} else {
				color = a1lib.mixColor(255, 0, 0);
			}

			window.alt1.overLayRect(color, opts[i].buttonx, opts[i].y - 8, opts[i].width, 18, 3600000, 2);
			// TODO: Maybe use intervals to make the overlay last longer than 20s
		}
	} else {
		console.log("Missing overlay permission");
	}
}
/**
* Required because closures apparently don't work the way I thought they would.
*/
function makeOptButtonCallback(index: number) {
	return function() {
		select(index);
	}
}

/**
* Returns true if the provided box is a "speech box" - one that has a title and some text.
* Returns false otherwise.
* It probably also has a chathead, and respresents a line of spoken dialog.
*/
function isSpeech(read: DialogTree | null): boolean {
	if (!read) return false;
	return (read.text && read.title && !read.opts) ? true : false;
}

/**
* Returns true if the provided box is an "options box" - one that has a title and some options.
* Returns false otherwise.
*/
function isOpts(read: DialogTree | null): boolean {
	if (!read) return false;
	return (!read.text && read.title && read.opts) ? true : false;
}

/**
* Returns true if the provided box is a "message box" - one that has text but no title and no options.
* Returns false otherwise.
*/
function isMessage(read: DialogTree | null): boolean {
	if (!read) return false;
	return (read.text && !read.title && !read.opts) ? true : false;
}

var anchorsVisited: object;
/**
* Turns a dialog tree into a string.
*/
function stringify(dialog: DialogTree, indentLevel=1, parent: DialogTree): string {
	const autoGenCat = "[[Category:Autogenerated dialogue that needs checking]]";
	if (dialog == null) return "{{Transcript missing}}";
	
	const playerName = new RegExp(playerInputField.value, "gi");
	if (!parent) anchorsVisited = {};

	if (dialog.anchor) {
		if (anchorsVisited[dialog.anchor]) {
			return "\n" + "*".repeat(indentLevel) + " {{Tact|continue|" + dialog.anchor + "}}" + autoGenCat;
		} else {
			anchorsVisited[dialog.anchor] = true;
		}
	}

	let retVal: string = "";
	//The dialog is a list of options, with a title
	if (isOpts(dialog)) {
		retVal = "\n";
		retVal += "*".repeat(indentLevel);
		retVal += " ";
		// Cache S. Issue-8 12/05/2023 -- Add in new wiki templates
		retVal += "{{Tselect|";
		//Assume first letter capitalized only
		retVal += dialog.title[0].toUpperCase() + dialog.title.slice(1).toLowerCase();
		// Cache S. Issue-8 12/05/2023 -- Add in new wiki templates
		retVal += "}}";

		if (dialog.anchor) {
			retVal += " {{Anchor|" + dialog.anchor + "}}" + autoGenCat;
		}

		for (let i: number = 0; i < dialog.opts.length; ++i) {
			retVal += "\n";
			retVal += "*".repeat(indentLevel + 1);
			retVal += " ";
			// Cache S. Issue-8 12/05/2023 -- Add in new wiki templates
			retVal += "{{Topt|";
			retVal += dialog.opts[i].text.replace(playerName, "Player");
			// Cache S. Issue-8 12/05/2023 -- Add in new wiki templates
			retVal += "}}";

			if (dialog.opts[i].next) {
				retVal += stringify(dialog.opts[i].next, indentLevel + 2, dialog);
			} else {
				retVal += "\n" + "*".repeat(indentLevel + 2) + " {{Transcript missing}}";
			}
		}
	//The dialog has a speaker
	} else if (isSpeech(dialog)) {
		//Is this a continuation of previous dialog?
		// Cache S. Issue-9 12/05/2023 -- Add ability to repeat the speaker's name for each dialog box
		if (parent
			&& !dialog.anchor
			&& isSpeech(parent)
			&& parent.title == dialog.title) {
				if (repeatSpeaker) {
					//Format for Wiki is `* '''NPC:''' Text`
					retVal = "\n"
						+ "*".repeat(indentLevel)
						+ " '''"
						+ titleOrPlayerName(dialog.title)
						+ ":''' "
						+ dialog.text.join(" ").replace(playerName, "Player");
				} else {
					retVal =  " " + dialog.text.join(" ").replace(playerName, "Player");
				}
		//Brand new dialog
		} else {
			//Format for Wiki is `* '''NPC:''' Text`
			retVal = "\n"
				+ "*".repeat(indentLevel)
				+ " '''"
				+ titleOrPlayerName(dialog.title)
				+ ":''' "
				+ dialog.text.join(" ").replace(playerName, "Player");
		}
		if (dialog.anchor) {
			retVal += "{{Anchor|" + dialog.anchor + "}}";
		}
		
		//Continue stringifying the next dialog until all dialog is added.
		if (dialog.next) retVal += stringify(dialog.next, indentLevel, dialog);
	//The dialog doesn't have a speaker.
	} else if (isMessage(dialog)) {
		//Is this a continuation of previous dialog?
		// Cache S. Issue-9 12/05/2023 -- Add ability to repeat the speaker's name for each dialog box
		if (parent
			&& !dialog.anchor
			&& isMessage(parent)) {
			// Begin Cache S. Issue-9 12/05/2023 -- break up code to match other code blocks
			if (repeatSpeaker) {
				//Format for Wiki is `* {{Tbox|Text}}`
				retVal = "\n";
				retVal += "*".repeat(indentLevel);
				retVal += " ";
				retVal += "{{Tbox|";
				retVal += dialog.text.join(" ").replace(playerName, "Player");
				retVal += "}}";
			} else {
				retVal = " ";
				retVal += dialog.text.join(" ").replace(playerName, "Player");
			}
			// End Cache S. Issue-9
		} else {
			// Cache S. Issue-9 12/05/2023 -- break up code to match other code blocks, and Add ability to repeat the speaker's name for each dialog box
			//Format for Wiki is `* {{Tbox|Text}}`
			retVal = "\n";
			retVal += "*".repeat(indentLevel);
			retVal += " ";
			retVal += "{{Tbox|";
			retVal += dialog.text.join(" ").replace(playerName, "Player");
			retVal += "}}";
			// End Cache S. Issue-9
		}
		if (dialog.anchor) {
			retVal += "{{Anchor|" + dialog.anchor + "}}";
		}
		
		if (dialog.next) retVal += stringify(dialog.next, indentLevel, dialog);
	} else {
		console.log("Could not make sense of the following dialog entry:");
		console.log(dialog);
	}
	return retVal;
}

var playerInputField: HTMLInputElement;

/**
* Returns the supplied string if it's equal (case insensitive) to the value contained in the playername input field,
* and return "Player" otherwise
*/
function titleOrPlayerName(ttl: string): string {
	if (ttl.toUpperCase() == playerInputField.value.toUpperCase()) {
		return "Player";
	} else {
		//Capitalize each word in a name, as that's on average more accurate.
		return ttl.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	}
}

/**
* Returns whether two dialog boxes are similar enough to be thought of as being the same.
* Currently, this is true if one of the following holds:
*     1. Both boxes are "speech boxes", their titles are identical, and their text is identical after replacing all linebreaks with spaces.
*     2. Both boxes are "option boxes", their titles are identical, and they feature the same number of options, with the same texts, in the same order.
*     3. Both boxes are "message boxes", and their text is identical after replacing all linebreaks with spaces.
* If one of the boxes is null or undefined, but the other is not, this returns false.
* In all other cases, undefined is returned.
*
* Some or all of these conditions may change in the future.
*/
function areTheSame(box1: DialogTree, box2: DialogTree): boolean {
	if (!!box1 != !!box2) return false;

	if (isSpeech(box1)
		&& isSpeech(box2)
		&& box1.title == box2.title
		&& box1.text.join(" ") == box2.text.join(" ")
	   ) {
		return true;
	} else if (isOpts(box1)
			   && isOpts(box2)
			  ) {
		// TODO: Maybe allow minor variation ("shows other options")
		if (box1.opts.length != box2.opts.length) {
			return false;
		}
		for (let i: number = 0; i < box1.opts.length; ++i) {
			if (box1.opts[i].text != box2.opts[i].text) {
				return false;
			}
		}
		return true;
	} else if (isMessage(box1)
			   && isMessage(box2)
			   && box1.text.join(" ") == box2.text.join(" ")
			  ) {
		return true;
	}

}

/**
* Fired by Alt1-s event handler when Alt+1 is pressed.
* Delegates to select() if a dialog option button is hovered.
* Does nothing otherwise.
*/
function eventSelect(evt) {
	let read: DialogReaderReturnObject | boolean = dialogReader.read();

	if (!read) return;
	if (!isOpts(read)) return;
	
	for (let i: number = 0; i < read.opts.length; ++i) {
		if (read.opts[i].hover) {
			select(i);
			return;
		}
	}

	console.log("Selected no option on Alt1 press");
}


function findEqualNode(node: DialogTree, anchorsVisited={}): DialogTree {
	let q: Queue = new Queue();
	q.enqueue(dialogTree);
	while (!q.isEmpty()) {
		let candidate: DialogTree = q.dequeue();
		if (candidate.anchor) {
			if (anchorsVisited[candidate.anchor]) {
				continue; // Looping forever is bad, let's not
			} else {
				anchorsVisited[candidate.anchor] = true;
			}
		}
		if (areTheSame(node, candidate)) {
			return candidate;
		}
		if (isOpts(candidate)) {
			for (let i: number = 0; i < candidate.opts.length; ++i) {
				q.enqueue(candidate.opts[i]);
			}
		} else if (candidate.next) {
			q.enqueue(candidate.next);
		}
	}
}

function getSavedPlayerName(): string {
	if (typeof Storage !== "undefined") { // We have local storage support
		var playerName = localStorage.playerName
		console.log("Retrieving: " + playerName);
		if (playerName) {
			console.log("Returning saved player name");
			return playerName; // to fetch from local storage
		} else {
			console.log("Returning default name (unset)");
			return "Player";
		}
	}
	console.log("Returning default name (no local storage)");
	return "Player";
}

function savePlayerName(): void {
	if (typeof Storage !== "undefined") { // We have local storage support
		console.log("Storing player name as " + playerInputField.value);
		localStorage.playerName = playerInputField.value;
	} else {
		console.log("Unable to save player name in local storage");
	}
}
