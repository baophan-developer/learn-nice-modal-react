export interface NiceModalState {
	id: string;
	args?: Record<string, unknown>;
	visible?: boolean;
	delayVisible?: boolean;
	keepMounted?: boolean;
}

export interface NiceModalStore {
    [key: string]: NiceModalStore
}
