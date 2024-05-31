/* eslint-disable react-refresh/only-export-components */
import React, {
	Dispatch,
	ReactNode,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useReducer,
} from "react";

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

export function show<T, C, P extends Partial<NiceModalArgs<React.FC<any>>>>(
	modal: React.FC<C>,
	args?: P,
): Promise<T>;
export function show<T>(modal: string, args?: Record<string, unknown>): Promise<T>;
export function show<T, P>(modal: string, args: P): Promise<T>;
export function show(
	modal: React.FC<any> | string,
	args?: NiceModalArgs<React.FC<any>> | Record<string, unknown>,
) {
	const modalId = getModalId(modal);
	if (typeof modal !== "string" && !MODAL_REGISTRY[modalId]) {
		register(modalId, modal as React.FC);
	}

	dispatch(showModal(modalId, args));
	if (!modalCallbacks[modalId]) {
		let theResolve!: (args?: unknown) => void;
		let theReject!: (args?: unknown) => void;

		const promise = new Promise((resolve, reject) => {
			theResolve = resolve;
			theReject = reject;
		});

		modalCallbacks[modalId] = {
			resolve: theResolve,
			reject: theReject,
			promise,
		};
	}
	return modalCallbacks[modalId].promise;
}

export function hide<T>(modal: string | React.FC<any>): Promise<T>;
export function hide(modal: string | React.FC<any>) {
	const modalId = getModalId(modal);
	dispatch(hideModal(modalId));
	delete modalCallbacks[modalId];
	if (!hideModalCallbacks[modalId]) {
		let theResolve!: (args?: unknown) => void;
		let theReject!: (args?: unknown) => void;

		const promise = new Promise((resolve, reject) => {
			theResolve = resolve;
			theReject = reject;
		});
		hideModalCallbacks[modalId] = {
			resolve: theResolve,
			reject: theReject,
			promise,
		};
	}
	return hideModalCallbacks[modalId].promise;
}

export const remove = (modal: string | React.FC<any>): void => {
	const modalId = getModalId(modal);
	dispatch(removeModal(modalId));
	delete modalCallbacks[modalId];
	delete hideModalCallbacks[modalId];
};

const setFlags = (modalId: string, flags: Record<string, unknown>): void => {
	dispatch(setModalFlags(modalId, flags));
};

export function useModal(): NiceModalHandler;
export function useModal(modal: string, args?: Record<string, unknown>): NiceModalHandler;
export function useModal<C, P extends Partial<NiceModalArgs<React.FC<C>>>>(): Omit<
	NiceModalHandler,
	"show"
> & {
	show: (args?: P) => Promise<unknown>;
};
export function useModal(modal?: any, args?: any): any {
	const modals = useContext(NiceModalContext);
	const contextModalId = useContext(NiceModalIdContext);
	let modalId: string | null = null;
	const isUseComponent = modal && typeof modal !== "string";
	if (!modal) {
		modalId = contextModalId;
	} else {
		modalId = getModalId(modal);
	}

	if (!modalId) throw new Error("No modal id found in NiceModal.useModal.");

	const mid = modalId as string;

	useEffect(() => {
		if (isUseComponent && !MODAL_REGISTRY[mid]) {
			register(mid, modal as React.FC, args);
		}
	}, [isUseComponent, mid, modal, args]);

	const modalInfo = modals[mid];

	const showCallback = useCallback(
		(args?: Record<string, unknown>) => {
			show(mid, args);
		},
		[mid],
	);

	const hideCallback = useCallback(() => {
		hide(mid);
	}, [mid]);

	const removeCallback = useCallback(() => {
		remove(mid);
	}, [mid]);

	const resolveCallback = useCallback(
		(args?: unknown) => {
			modalCallbacks[mid]?.resolve(args);
			delete modalCallbacks[mid];
		},
		[mid],
	);

	const rejectCallback = useCallback(
		(args?: unknown) => {
			modalCallbacks[mid]?.reject(args);
			delete modalCallbacks[mid];
		},
		[mid],
	);

	const resolveHide = useCallback(
		(args?: unknown) => {
			hideModalCallbacks[mid]?.resolve(args);
			delete hideModalCallbacks[mid];
		},
		[mid],
	);

	return useMemo(
		() => ({
			id: mid,
			args: modalInfo?.args,
			visible: !!modalInfo?.visible,
			keepMounted: !modalInfo?.keepMounted,
			show: showCallback,
			hide: hideCallback,
			remove: removeCallback,
			resolve: resolveCallback,
			reject: rejectCallback,
			resolveHide,
		}),
		[
			hideCallback,
			mid,
			modalInfo?.args,
			modalInfo?.keepMounted,
			modalInfo?.visible,
			rejectCallback,
			removeCallback,
			resolveCallback,
			resolveHide,
			showCallback,
		],
	);
}

export const create = <P extends {}>(
	Comp: React.ComponentType<P>,
): React.FC<P & NiceModalHocProps> => {
	return ({defaultVisible, keepMounted, id, ...props}) => {
		const {args, show} = useModal(id);

		const modals = useContext(NiceModalContext);
		const shouldMount = !!modals[id];

		useEffect(() => {
			if (defaultVisible) {
				show();
			}
			ALREADY_MOUNTED[id] = true;
			return () => {
				delete ALREADY_MOUNTED[id];
			};
		}, [defaultVisible, id, show]);

		useEffect(() => {
			if (keepMounted) setFlags(id, {keepMounted: true});
		}, [id, keepMounted]);

		const delayVisible = modals[id]?.delayVisible;

		useEffect(() => {
			if (delayVisible) {
				show(args);
			}
		}, [args, delayVisible, show]);

		if (!shouldMount) return null;
		return (
			<NiceModalIdContext.Provider value={id}>
				<Comp {...(props as unknown as P)} {...args} />
			</NiceModalIdContext.Provider>
		);
	};
};

const register = <T extends React.FC<any>>(
	id: string,
	comp: T,
	props?: Partial<NiceModalArgs<T>>,
): void => {
	if (!MODAL_REGISTRY[id]) {
		MODAL_REGISTRY[id] = {comp, props};
	} else {
		MODAL_REGISTRY[id].props = props;
	}
};

export const unregister = (id: string): void => {
	delete MODAL_REGISTRY[id];
};

const NiceModalPlaceholder: React.FC = () => {
	const modals = useContext(NiceModalContext);
	const visibleModalIds = Object.keys(modals).filter((id) => !!modals[id]);
	visibleModalIds.forEach((id) => {
		if (!MODAL_REGISTRY[id] && !ALREADY_MOUNTED[id]) {
			console.warn(`
				No modal found for id: ${id}. Please check the id of it is registered or declared via JSX.	
			`);
			return;
		}
	});

	const toRender = visibleModalIds
		.filter((id) => MODAL_REGISTRY[id])
		.map((id) => ({id, ...MODAL_REGISTRY[id]}));

	return (
		<>
			{toRender.map((t) => (
				<t.comp key={t.id} id={t.id} {...t.props} />
			))}
		</>
	);
};

const InnerContextProvider: React.FC<any> = ({children}) => {
	const arr = useReducer(reducer, initialState);
	const modals = arr[0];
	dispatch = arr[1];
	return (
		<NiceModalContext.Provider value={modals}>
			{children}
			<NiceModalPlaceholder />
		</NiceModalContext.Provider>
	);
};

export const Provider: React.FC<Record<string, unknown>> | any = ({
	children,
	dispatch: givenDispatch,
	modals: givenModals,
}: {
	children: ReactNode;
	dispatch?: Dispatch<NiceModalAction>;
	modals?: NiceModalStore;
}) => {
	if (!givenDispatch || !givenModals) {
		return <InnerContextProvider>{children}</InnerContextProvider>;
	}
	dispatch = givenDispatch;
	return (
		<NiceModalContext.Provider value={givenModals}>
			{children}
			<NiceModalPlaceholder />
		</NiceModalContext.Provider>
	);
};

export const ModalDef: React.FC<Record<string, unknown>> | any = ({
	id,
	component,
}: {
	id: string;
	component: React.FC<any>;
}) => {
	useEffect(() => {
		register(id, component);
		return () => {
			unregister(id);
		};
	}, [component, id]);
	return null;
};

export const ModalHolder: React.FC<Record<string, unknown>> | any = ({
	modal,
	handler,
	...props
}: {
	modal: string | React.FC<any>;
	handler: any;
	[key: string]: any;
}) => {
	const mid = useMemo(() => getUid(), []);
	const ModalComp = typeof modal === "string" ? MODAL_REGISTRY[modal]?.comp : modal;

	if (!handler) throw new Error("No handler found in NiceModal.ModalHolder.");
	if (!ModalComp)
		throw new Error(`No modal found for id: ${modal} in NiceModal.ModalHolder.`);
	handler.show = useCallback((args: any) => show(mid, args), [mid]);
	handler.hide = useCallback(() => hide(mid), [mid]);

	return <ModalComp id={mid} {...props} />;
};

export const antdModal = (
	modal: NiceModalHandler,
): {
	visible: boolean;
	onCancel: () => void;
	onOk: () => void;
	afterClose: () => void;
} => {
	return {
		visible: modal.visible,
		onOk: () => modal.hide(),
		onCancel: () => modal.hide(),
		afterClose: () => {
			modal.resolveHide();
			if (!modal.keepMounted) modal.remove();
		},
	};
};

export const antdModalV5 = (
	modal: NiceModalHandler,
): {open: boolean; onCancel: () => void; onOk: () => void; afterClose: () => void} => {
	const {onOk, onCancel, afterClose} = antdModal(modal);
	return {
		open: modal.visible,
		onOk,
		onCancel,
		afterClose,
	};
};

export const antdDrawer = (
	modal: NiceModalHandler,
): {
	visible: boolean;
	onClose: () => void;
	afterVisibleChange: (visible: boolean) => void;
} => ({
	visible: modal.visible,
	onClose: () => modal.hide(),
	afterVisibleChange: (v: boolean) => {
		if (!v) {
			modal.resolveHide();
		}
		!v && !modal.keepMounted && modal.remove();
	},
});

export const antdDrawerV5 = (
	modal: NiceModalHandler,
): {
	open: boolean;
	onClose: () => void;
	afterOpenChange: (visible: boolean) => void;
} => {
	const {onClose, afterVisibleChange: afterOpenChange} = antdDrawer(modal);
	return {
		open: modal.visible,
		onClose,
		afterOpenChange,
	};
};

export const muiDialog = (
	modal: NiceModalHandler,
): {
	open: boolean;
	onClose: () => void;
	onExited: () => void;
} => {
	return {
		open: modal.visible,
		onClose: () => modal.hide(),
		onExited: () => {
			modal.resolveHide();
			!modal.keepMounted && modal.remove();
		},
	};
};

export const muiDialogV5 = (
	modal: NiceModalHandler,
): {open: boolean; onClose: () => void; TransitionProps: {onExited: () => void}} => {
	return {
		open: modal.visible,
		onClose: () => modal.hide(),
		TransitionProps: {
			onExited: () => {
				modal.resolveHide();
				!modal.keepMounted && modal.remove();
			},
		},
	};
};

export const bootstrapDialog = (
	modal: NiceModalHandler,
): {show: boolean; onHide: () => void; onExited: () => void} => {
	return {
		show: modal.visible,
		onHide: () => modal.hide(),
		onExited: () => {
			modal.resolveHide();
			!modal.keepMounted && modal.remove();
		},
	};
};

const NiceModal = {
	Provider,
	ModalDef,
	ModalHolder,
	NiceModalContext,
	create,
	register,
	getModal,
	show,
	hide,
	remove,
	useModal,
	reducer,
	antdModal,
	antdDrawer,
	muiDialog,
	bootstrapDialog,
};

export default NiceModal;
