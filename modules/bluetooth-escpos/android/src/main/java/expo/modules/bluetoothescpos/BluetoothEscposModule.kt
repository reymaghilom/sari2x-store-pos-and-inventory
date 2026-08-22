package expo.modules.bluetoothescpos

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.IOException
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

private const val CONNECT_TIMEOUT_SECONDS = 12L
private val SERIAL_PORT_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

class BluetoothEscposModule : Module() {
  @Volatile private var socket: BluetoothSocket? = null

  private fun context(): Context = appContext.reactContext
    ?: throw CodedException("Bluetooth is unavailable while the app is starting.")

  private fun adapter(): BluetoothAdapter? {
    val manager = context().getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
    return manager?.adapter
  }

  private fun requirePermission() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      context().checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
      throw CodedException("Bluetooth permission is required.")
    }
  }

  @SuppressLint("MissingPermission")
  private fun deviceMap(device: BluetoothDevice) = mapOf(
    "id" to device.address,
    "address" to device.address,
    "name" to (device.name ?: "Bluetooth printer"),
    "bonded" to (device.bondState == BluetoothDevice.BOND_BONDED)
  )

  @Synchronized
  private fun closeSocket() {
    try { socket?.close() } catch (_: IOException) { }
    socket = null
  }

  override fun definition() = ModuleDefinition {
    Name("BluetoothEscpos")
    Function("isAvailable") { adapter() != null }

    @SuppressLint("MissingPermission")
    Function("isEnabled") {
      requirePermission()
      adapter()?.isEnabled == true
    }

    @SuppressLint("MissingPermission")
    AsyncFunction("getPairedDevices") {
      requirePermission()
      val bluetooth = adapter() ?: throw CodedException("This Android device does not support Bluetooth Classic.")
      if (!bluetooth.isEnabled) throw CodedException("Bluetooth is turned off.")
      bluetooth.bondedDevices.orEmpty().sortedBy { it.name ?: it.address }.map(::deviceMap)
    }

    @SuppressLint("MissingPermission")
    AsyncFunction("connect") { address: String ->
      requirePermission()
      val bluetooth = adapter() ?: throw CodedException("This Android device does not support Bluetooth Classic.")
      if (!bluetooth.isEnabled) throw CodedException("Bluetooth is turned off.")
      val device = bluetooth.bondedDevices.firstOrNull { it.address.equals(address, ignoreCase = true) }
        ?: throw CodedException("The selected printer is no longer paired with this phone.")
      closeSocket()
      val candidate = device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
      bluetooth.cancelDiscovery()
      val executor = Executors.newSingleThreadExecutor()
      try {
        val future = executor.submit { candidate.connect() }
        try { future.get(CONNECT_TIMEOUT_SECONDS, TimeUnit.SECONDS) }
        catch (_: TimeoutException) { candidate.close(); throw CodedException("Printer connection timed out.") }
        catch (error: Exception) { candidate.close(); throw CodedException("Could not connect to the printer.", error) }
        socket = candidate
        deviceMap(device)
      } finally { executor.shutdownNow() }
    }

    AsyncFunction("disconnect") { closeSocket() }
    Function("isConnected") { socket?.isConnected == true }
    Function("connectedAddress") { if (socket?.isConnected == true) socket?.remoteDevice?.address else null }

    AsyncFunction("write") { bytes: List<Int> ->
      val active = socket
      if (active?.isConnected != true) throw CodedException("The Bluetooth printer is disconnected.")
      try {
        active.outputStream.write(ByteArray(bytes.size) { index -> bytes[index].coerceIn(0, 255).toByte() })
        active.outputStream.flush()
      } catch (error: IOException) {
        closeSocket()
        throw CodedException("The printer disconnected while receiving the receipt.", error)
      }
    }

    OnDestroy { closeSocket() }
  }
}
