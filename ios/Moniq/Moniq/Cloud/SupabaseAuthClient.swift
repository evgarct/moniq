import Foundation
import Supabase

/// Thin wrapper around the Supabase Swift SDK client, configured from
/// `MoniqSupabaseURL`/`MoniqSupabaseAnonKey` (see Config/Cloud.local.xcconfig.example).
/// Skeleton only — auth screens call `signIn`/`signUp`/`signOut`; no session
/// persistence/refresh wiring beyond what the SDK provides by default yet.
final class SupabaseAuthClient: Sendable {
    static let shared = SupabaseAuthClient()

    private let client: SupabaseClient

    private init() {
        guard
            let urlString = Bundle.main.object(forInfoDictionaryKey: "MoniqSupabaseURL") as? String,
            let url = URL(string: urlString),
            let anonKey = Bundle.main.object(forInfoDictionaryKey: "MoniqSupabaseAnonKey") as? String,
            !anonKey.isEmpty
        else {
            preconditionFailure("MoniqSupabaseURL/MoniqSupabaseAnonKey missing — set Config/Cloud.local.xcconfig")
        }
        client = SupabaseClient(supabaseURL: url, supabaseKey: anonKey)
    }

    var currentSession: Session? {
        get async { try? await client.auth.session }
    }

    func signIn(email: String, password: String) async throws {
        try await client.auth.signIn(email: email, password: password)
    }

    func signUp(email: String, password: String) async throws {
        try await client.auth.signUp(email: email, password: password)
    }

    func signOut() async throws {
        try await client.auth.signOut()
    }
}
