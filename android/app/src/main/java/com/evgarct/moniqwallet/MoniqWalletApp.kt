package com.evgarct.moniqwallet

import android.app.Application
import com.evgarct.moniqwallet.core.network.WalletApiClient
import com.evgarct.moniqwallet.core.prefs.CapturedNotificationLog

class MoniqWalletApp : Application() {

    val walletApiClient: WalletApiClient by lazy {
        WalletApiClient(baseUrl = BuildConfig.WALLET_WEBHOOK_URL, secret = BuildConfig.WALLET_WEBHOOK_SECRET)
    }

    val capturedNotificationLog: CapturedNotificationLog by lazy {
        CapturedNotificationLog(applicationContext)
    }

    companion object {
        lateinit var instance: MoniqWalletApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }
}
