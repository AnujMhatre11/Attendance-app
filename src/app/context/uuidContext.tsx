import { createContext, Dispatch, ReactNode, SetStateAction, useState } from "react";

export type UUIDType = {
    UUID: string | null;
};

export type UUIDContextType = {
    UUID: UUIDType;
    setUUID: Dispatch<SetStateAction<UUIDType>>;
};

type UUIDProviderProps = {
    children: ReactNode;
};

const defaultUUID: UUIDType = { UUID: null };

export const UUIDContext = createContext<UUIDContextType>({
    UUID: defaultUUID,
    setUUID: () => {},
});

export const UUIDProvider = ({ children }: UUIDProviderProps) => {
    const [UUID, setUUID] = useState<UUIDType>(defaultUUID);

    return (
        <UUIDContext.Provider value={{ UUID, setUUID }}>
            {children}
        </UUIDContext.Provider>
    );
};
