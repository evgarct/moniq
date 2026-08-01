import Observation
import SwiftUI

@MainActor
@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var isSubmitting = false
    var showsError = false

    private let authClient: any AuthClient

    init(authClient: any AuthClient) {
        self.authClient = authClient
    }

    var canSubmit: Bool {
        email.contains("@") && password.count >= 6 && !isSubmitting
    }

    func signIn() async -> Bool {
        guard canSubmit else { return false }
        isSubmitting = true
        showsError = false
        defer { isSubmitting = false }
        do {
            try await authClient.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password)
            return true
        } catch {
            showsError = true
            return false
        }
    }
}

struct LoginView: View {
    private enum Field: Hashable { case email, password }

    @State private var viewModel: LoginViewModel
    @FocusState private var focusedField: Field?
    var onSignedIn: () -> Void

    init(authClient: any AuthClient, onSignedIn: @escaping () -> Void) {
        _viewModel = State(initialValue: LoginViewModel(authClient: authClient))
        self.onSignedIn = onSignedIn
    }

    var body: some View {
        ScrollView {
            GlassEffectContainer(spacing: 24) {
                VStack(alignment: .leading, spacing: 36) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("login.brand")
                            .font(.system(size: 48, weight: .semibold, design: .serif))
                            .tracking(-1.2)
                        Text("login.subtitle")
                            .font(.body)
                            .foregroundStyle(MoniqColor.muted)
                    }

                    MoniqGlassSurface {
                        VStack(spacing: 0) {
                            TextField("login.email", text: $viewModel.email)
                                .textContentType(.username)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .focused($focusedField, equals: .email)
                                .submitLabel(.next)
                                .onSubmit { focusedField = .password }
                                .padding(.horizontal, 18)
                                .frame(minHeight: 56)
                                .accessibilityIdentifier("login.email")

                            Divider().padding(.horizontal, 18)

                            SecureField("login.password", text: $viewModel.password)
                                .textContentType(.password)
                                .focused($focusedField, equals: .password)
                                .submitLabel(.go)
                                .onSubmit(submit)
                                .padding(.horizontal, 18)
                                .frame(minHeight: 56)
                                .accessibilityIdentifier("login.password")
                        }
                        .padding(.vertical, 4)
                    }

                    if viewModel.showsError {
                        Text("login.error")
                            .font(.footnote)
                            .foregroundStyle(MoniqColor.destructive)
                            .accessibilityIdentifier("login.error")
                    }

                    Button(action: submit) {
                        HStack {
                            if viewModel.isSubmitting { ProgressView() }
                            Text("login.action")
                        }
                        .foregroundStyle(viewModel.canSubmit ? MoniqColor.background : MoniqColor.muted)
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.glassProminent)
                    .tint(MoniqColor.foreground)
                    .controlSize(.large)
                    .disabled(!viewModel.canSubmit)
                    .accessibilityIdentifier("login.submit")
                }
            }
            .padding(.horizontal, 24)
            .padding(.top, 96)
            .padding(.bottom, 40)
            .frame(maxWidth: 520)
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .moniqCanvas()
    }

    private func submit() {
        focusedField = nil
        Task {
            if await viewModel.signIn() { onSignedIn() }
        }
    }
}

#if DEBUG
#Preview("Login") {
    LoginView(authClient: DemoAuthClient()) {}
}
#endif
