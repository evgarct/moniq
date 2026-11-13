package com.evgarct.moniq

import android.app.Application
import com.evgarct.moniq.data.Net
import com.evgarct.moniq.data.Repo
import com.evgarct.moniq.data.SessionStore
import com.evgarct.moniq.wallet.CaptureStore
import com.evgarct.moniq.wallet.Notifier

class MoniqApp : Application() {
    lateinit var sessions: SessionStore
        private set
    lateinit var net: Net
        private set
    lateinit var repo: Repo
        private set
    lateinit var captures: CaptureStore
        private set

    override fun onCreate() {
        super.onCreate()
        sessions = SessionStore(this)
        net = Net(sessions)
        repo = Repo(this, net, sessions)
        captures = CaptureStore(this)
        Notifier.ensureChannel(this)
    }
}
