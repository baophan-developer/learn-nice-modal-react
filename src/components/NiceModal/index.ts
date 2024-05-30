import React, {createContext} from "react";

export interface NiceModalState {
	id: string;
	args?: Record<string, unknown>;
	visible?: boolean;
	delayVisible?: boolean;
	keepMounted?: boolean;
}

export interface NiceModalStore {
	[key: string]: NiceModalState;
}

export interface NiceModalAction {
	type: string;
	payload: {
		modalId: string;
		args?: Record<string, unknown>;
		flags?: Record<string, unknown>;
	};
}

interface NiceModalCallbacks {
	[modeId: string]: {
		resolve: (args: unknown) => void;
		reject: (args: unknown) => void;
		promise: Promise<unknown>;
	};
}

export interface NiceModalHandler<Props = Record<string, unknown>>
	extends NiceModalState {
	visible: boolean;
	keepMounted: boolean;
	show: (args?: Props) => Promise<unknown>;
	hide: () => Promise<unknown>;
	resolve: (args?: unknown) => void;
	reject: (args?: unknown) => void;
	remove: () => void;
	resolveHide: (args?: unknown) => void;
}

export interface NiceModalHocProps {
	id: string;
	defaultVisible?: boolean;
	keepMounted?: boolean;
}

const symModalId = Symbol("NiceModalId");

const initialState: NiceModalStore = {};

export const NiceModalContext = createContext<NiceModalStore>(initialState);

const NiceModalIdContext = createContext<string | null>(null);

const MODAL_REGISTRY: {
	[id: string]: {
		comp: React.FC<any>;
		props?: Record<string, unknown>;
	};
} = {};

const ALREADY_MOUNTED: any = {};

let uidSeed = 0;

let dispatch: React.Dispatch<NiceModalAction> = () => {
	throw new Error(
		"No dispatch method detected, did you embed your app with NiceModal.Provider",
	);
};

const getUid = () => `_nice_modal_${uidSeed++}`;

export const reducer = (
	state: NiceModalStore = initialState,
	action: NiceModalAction,
): NiceModalStore => {
	switch (action.type) {
		case "nice-modal/show": {
			const {modalId, args} = action.payload;
			return {
				...state,
				[modalId]: {
					...state[modalId],
					id: modalId,
					args,
					visible: !!ALREADY_MOUNTED[modalId],
					delayVisible: !ALREADY_MOUNTED[modalId],
				},
			};
		}
		case "nice-modal/hide": {
			const {modalId} = action.payload;
			if (!state[modalId]) return state;
			return {
				...state,
				[modalId]: {
					...state[modalId],
					visible: false,
				},
			};
		}
		case "nice-modal/remove": {
			const {modalId} = action.payload;
			const newSate = {...state};
			delete newSate[modalId];
			return newSate;
		}
		case "nice-modal/set-flags": {
			const {modalId, flags} = action.payload;
			return {
				...state,
				[modalId]: {
					...state[modalId],
					...flags,
				},
			};
		}
		default:
			return state;
	}
};

function getModal(modalId: string): React.FC<any> | undefined {
	return MODAL_REGISTRY[modalId]?.comp;
}

function showModal(modalId: string, args?: Record<string, unknown>): NiceModalAction {
	return {
		type: "nice-modal/show",
		payload: {
			modalId,
			args,
		},
	};
}

function setModalFlags(modalId: string, flags: Record<string, unknown>): NiceModalAction {
	return {
		type: "nice-modal/set-flags",
		payload: {
			modalId,
			flags,
		},
	};
}

function hideModal(modalId: string): NiceModalAction {
	return {
		type: "nice-modal/hide",
		payload: {
			modalId,
		},
	};
}

function removeModal(modalId: string): NiceModalAction {
	return {
		type: "nice-modal/remove",
		payload: {
			modalId,
		},
	};
}

const modalCallbacks: NiceModalCallbacks = {};

const hideModalCallbacks: NiceModalCallbacks = {};

const getModalId = (modal: string | React.FC<any> | any): string => {
	if (typeof modal === "string") return modal as string;
	if (!modal[symModalId]) {
		modal[symModalId] = getUid();
	}
	return modal[symModalId];
};

type NiceModalArgs<T> = T extends
	| keyof JSX.IntrinsicElements
	| React.JSXElementConstructor<any>
	? React.ComponentProps<T>
	: Record<string, unknown>;
