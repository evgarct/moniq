import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

android {
    namespace = "com.evgarct.moniqwallet"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.evgarct.moniqwallet"
        minSdk = 28
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        // Wallet webhook target on Gabi (telegram-bot repo, /api/wallet-notification).
        // Real values live in android/local.properties (gitignored) — never committed.
        buildConfigField(
            "String",
            "WALLET_WEBHOOK_URL",
            "\"${localProperties.getProperty("wallet.webhook.url", "")}\"",
        )
        buildConfigField(
            "String",
            "WALLET_WEBHOOK_SECRET",
            "\"${localProperties.getProperty("wallet.webhook.secret", "")}\"",
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.08.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
