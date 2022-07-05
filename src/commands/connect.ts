import { activeEnvironment, FermyonEnvironment, promptSwitch, setActive } from "../fermyon/environment";
import { FERMYON_STATUS_BAR_ITEM } from "../fermyon/statusbar";
import { isCancelled } from "../utils/cancellable";

export async function connect() {
    const environment_ = await promptSwitch();
    if (isCancelled(environment_)) {
        return;
    }
    const environment = environment_.value;

    setUI(environment);
}

export async function connectTo(environment: FermyonEnvironment | undefined) {
    await setActive(environment?.name);
    setUI(environment);
}

export function connectToActive() {
    const environment = activeEnvironment();
    setUI(environment);
}

function setUI(environment: FermyonEnvironment | undefined) {
    if (environment === undefined) {
        // clear status bar
        FERMYON_STATUS_BAR_ITEM.hide();
        // remove terminal EVs
    } else {
        // update status bar
        FERMYON_STATUS_BAR_ITEM.show(environment.name, environment.hippoUrl);
        // update any terminal EVs, etc.
    }
}
