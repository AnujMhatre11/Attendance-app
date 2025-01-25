import { PermissionsAndroid, Alert, Platform } from "react-native";
import { BleManager, Device, State } from "react-native-ble-plx";
import { insertStudentUUIDinActiveSessions } from "../api/useGetData";
import BLEAdvertiser from 'react-native-ble-advertiser';

interface BLEAPI {
  requestPermissions(): Promise<boolean>;
  startScanning(uuids: string | string[], student_uuid: string): Promise<boolean>;
  stopScanning(): void;
  startAdvertising(uuid: string): Promise<void>;
  stopAdvertising(): Promise<void>;
  cleanup(): void;
}

let isAdvertising = false;
export default function bleService(): BLEAPI {
  const manager = new BleManager();
  let scanSubscription: any = null;

  const PERMISSIONS = {
    android: [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    ],
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== "android") {
      console.warn("Permissions only implemented for Android");
      return true;
    }

    try {
      const results = await Promise.all(
        PERMISSIONS.android.map((permission) =>
          PermissionsAndroid.request(permission, {
            title: "Bluetooth Permissions",
            message: "This app requires Bluetooth permissions to function properly",
            buttonPositive: "OK",
          })
        )
      );

      return results.every((result) => result === PermissionsAndroid.RESULTS.GRANTED);
    } catch (error) {
      console.error("Error requesting permissions:", error);
      return false;
    }
  };

  const startScanning = async (uuids: string | string[], student_uuid: string): Promise<boolean> => {
    try {
      console.log("Starting scan for UUIDs:", uuids);
      
      const state = await manager.state();
      if (state !== State.PoweredOn) {
        Alert.alert("Bluetooth is not enabled");
        return false;
      }

      scanSubscription = manager.onStateChange((state) => {
        if (state === State.PoweredOn) {
          manager.startDeviceScan(
            Array.isArray(uuids) ? uuids : [uuids],
            { allowDuplicates: false },
            (error, device) => {
              if (error) {
                console.error("Scan error:", error);
                Alert.alert("Error", "Failed to scan for devices");
                return;
              }

              if (device && device.serviceUUIDs) {
                console.log("Found device:", device.id, device.serviceUUIDs);
                try {
                  const foundUUID = device.serviceUUIDs[0];
                  insertStudentUUIDinActiveSessions(foundUUID, student_uuid);
                  Alert.alert("Attendance Marked Successfully");
                  stopScanning();
                } catch (error) {
                  console.error("Error processing device:", error);
                  Alert.alert("Error", "Failed to mark attendance");
                }
              }
            }
          );
        }
      }, true);

      return true;
    } catch (error) {
      console.error("Error starting scan:", error);
      return false;
    }
  };

  const stopScanning = (): void => {
    console.log("Stopping scan");
    manager.stopDeviceScan();
    if (scanSubscription) {
      scanSubscription.remove();
      scanSubscription = null;
      manager.destroy()
    }
  };

  const startAdvertising = async (uuid: string): Promise<void> => {
    try {
      BLEAdvertiser.enableAdapter();
      
      // Convert UUID to a compatible format if needed
      // const cleanUUID = uuid.replace(/-/g, '');
      // console.log("clean uuid",cleanUUID);
      
      
      const advertiserConfig = {
        serviceUuids: [uuid],
        includeTxPowerLevel: true,
        includeDeviceName: false,
        manufacturerId: 0x00E0, // You can customize this
        manufacturerData: [0x00], // You can customize this
      };
      BLEAdvertiser.setCompanyId(advertiserConfig.manufacturerId)
      await BLEAdvertiser.broadcast(uuid, advertiserConfig.manufacturerData, {
        advertiseMode: BLEAdvertiser.ADVERTISE_MODE_LOW_POWER,
        txPowerLevel: BLEAdvertiser.ADVERTISE_TX_POWER_LOW,
        connectable: false,
        includeDeviceName: false,
        includeTxPowerLevel: false
      });
      isAdvertising = true;
      console.log('Started advertising with UUID:', uuid);
    } catch (error) {
      console.error("Error starting advertisement:", error);
      throw error;
    }
  };

  const stopAdvertising = async (): Promise<void> => {
    try {
      if (isAdvertising) {
        await BLEAdvertiser.stopBroadcast();
        isAdvertising = false;
        console.log('Stopped advertising');
      }
    } catch (error) {
      console.error("Error stopping advertisement:", error);
      throw error;
    }
  };

  const cleanup = (): void => {
    console.log("Cleaning up BLE resources");
    stopScanning();
    manager.destroy();
  };

  return {
    requestPermissions,
    startScanning,
    stopScanning,
    startAdvertising,
    stopAdvertising,
    cleanup,
  };
}