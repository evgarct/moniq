import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

val localProperties = Properties().apply {
    val file = rootProject.file("local.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}

fun local(name: String, fallback: String = ""): String =
    "\"${localProperties.getProperty(name, fallback).replace("\\", "\\\\").replace("\"", "\\\"")}\""

android {
    namespace = "com.evgarct.moniq"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.evgarct.moniq"
        minSdk = 31
        targetSdk = 37
        versionCode = 1
        versionName = "1.0"

        // Real values live in android/local.properties (gitignored), see local.properties.example.
        buildConfigField("String", "API_BASE_URL", local("moniq.api.url", "https://moniq.fyi"))
        buildConfigField("String", "SUPABASE_URL", local("moniq.supabase.url"))
        buildConfigField("String", "SUPABASE_ANON_KEY", local("moniq.supabase.anonKey"))
        buildConfigField("String", "HERMES_URL", local("hermes.api.url"))
        buildConfigField("String", "HERMES_KEY", local("hermes.api.key"))
        // "last4:Wallet name" pairs, comma separated: Google Wallet cards that record automatically.
        buildConfigField("String", "WALLET_CARDS", local("wallet.cards"))
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
    implementation("androidx.compose.animation:animation")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.fragment:fragment-ktx:1.8.5")
    implementation("androidx.biometric:biometric:1.1.0")
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-process:2.8.7")
    implementation("androidx.work:work-runtime-ktx:2.11.2")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    debugImplementation("androidx.compose.ui:ui-tooling")
}
