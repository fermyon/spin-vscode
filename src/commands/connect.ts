import { activeEnvironment, FermyonEnvironment, promptSwitch, setActive } from "../fermyon/environment";
import { FERMYON_STATUS_BAR_ITEM } from "../fermyon/statusbar";
import { isCancelled } from "../utils/cancellable";
import { setAmbientContext } from '../utils/context';

const SPIN_CONNECTED_CONTEXT = "spin.connected";

export async function connect() {
    const environment_ = await promptSwitch();
    if (isCancelled(environment_)) {
        return;
    }
    const environment = environment_.value;

    await setUI(environment);
}

export async function connectTo(environment: FermyonEnvironment | undefined) {
    await setActive(environment?.name);
    await setUI(environment);
}

export async function connectToActive() {
    const environment = activeEnvironment();
    await setUI(environment);
}

async function setUI(environment: FermyonEnvironment | undefined) {
    if (environment === undefined) {
        // clear status bar
        FERMYON_STATUS_BAR_ITEM.hide();
        // remove terminal EVs
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, false);
    } else {
        // update status bar
        FERMYON_STATUS_BAR_ITEM.show(environment.name, environment.hippoUrl);
        // update any terminal EVs, etc.
        await setAmbientContext(SPIN_CONNECTED_CONTEXT, true);
    }
}
