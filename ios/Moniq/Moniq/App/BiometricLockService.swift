import Foundation
import LocalAuthentication
import Observation

enum BiometricAvailability: Equatable {
    case available
    case unavailable
    case lockedOut
}

@MainActor
protocol BiometricLocking: AnyObject {
    var isEnabled: Bool { get }
    var availability: BiometricAvailability { get }
    func setEnabled(_ enabled: Bool) async throws
    func unlock() async -> Bool
    func reset()
}

@MainActor
@Observable
final class BiometricLockService: BiometricLocking {
    private let defaults: UserDefaults
    private let enabledKey = "moniq.face-id.enabled"
    private let automationResult: Bool?

    private(set) var isEnabled: Bool

    init(defaults: UserDefaults = .standard, automationResult: Bool? = nil) {
        self.defaults = defaults
        self.automationResult = automationResult ?? Self.processAutomationResult
#if DEBUG
        isEnabled = defaults.bool(forKey: enabledKey) || ProcessInfo.processInfo.arguments.contains("-MONIQ_FORCE_BIOMETRIC_LOCK")
#else
        isEnabled = defaults.bool(forKey: enabledKey)
#endif
    }

    var availability: BiometricAvailability {
        if automationResult != nil { return .available }
        let context = LAContext()
        var error: NSError?
        if context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) { return .available }
        return error?.code == LAError.biometryLockout.rawValue ? .lockedOut : .unavailable
    }

    func setEnabled(_ enabled: Bool) async throws {
        if enabled {
            guard await evaluate(reason: String(localized: "biometrics.enable.reason")) else {
                throw CancellationError()
            }
        }
        isEnabled = enabled
        defaults.set(enabled, forKey: enabledKey)
    }

    func unlock() async -> Bool {
        guard isEnabled else { return true }
        return await evaluate(reason: String(localized: "biometrics.unlock.reason"))
    }

    func reset() {
        isEnabled = false
        defaults.removeObject(forKey: enabledKey)
    }

    private func evaluate(reason: String) async -> Bool {
        if let automationResult { return automationResult }
        let context = LAContext()
        context.localizedCancelTitle = String(localized: "common.cancel")
        do {
            return try await context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, localizedReason: reason)
        } catch {
            return false
        }
    }

    private static var processAutomationResult: Bool? {
#if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-MONIQ_BIOMETRICS_SUCCESS") { return true }
        if ProcessInfo.processInfo.arguments.contains("-MONIQ_BIOMETRICS_FAILURE") { return false }
#endif
        return nil
    }
}
