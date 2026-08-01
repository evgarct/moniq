import XCTest

final class MoniqUITests: XCTestCase {
    @MainActor
    func testDemoBalanceNavigationAndProfileSettings() {
        let app = XCUIApplication()
        app.launchArguments = ["-MONIQ_DEMO_MODE", "-MONIQ_BIOMETRICS_SUCCESS"]
        app.launch()

        XCTAssertTrue(app.descendants(matching: .any)["balance.inventory"].waitForExistence(timeout: 8))
        app.buttons.matching(identifier: "balance.wallet.22222222-2222-2222-2222-222222222221").firstMatch.tap()
        XCTAssertTrue(app.navigationBars["Activity"].waitForExistence(timeout: 4))

        app.tabBars.buttons["Profile"].tap()
        app.buttons["Settings"].tap()
        let faceID = app.switches["settings.faceID.toggle"]
        XCTAssertTrue(faceID.waitForExistence(timeout: 3))
        faceID.tap()
        XCTAssertTrue(faceID.waitForExistence(timeout: 3))
    }

    @MainActor
    func testProductionLikeLaunchShowsLogin() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.textFields["login.email"].waitForExistence(timeout: 8))
        XCTAssertTrue(app.secureTextFields["login.password"].exists)
        XCTAssertTrue(app.buttons["login.submit"].exists)
    }

    @MainActor
    func testBiometricLockState() {
        let app = XCUIApplication()
        app.launchArguments = ["-MONIQ_DEMO_MODE", "-MONIQ_FORCE_BIOMETRIC_LOCK", "-MONIQ_BIOMETRICS_FAILURE"]
        app.launch()
        XCTAssertTrue(app.buttons["biometrics.unlock"].waitForExistence(timeout: 8))
    }
}
