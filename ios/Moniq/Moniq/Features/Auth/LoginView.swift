import SwiftUI

@MainActor
@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var isSubmitting = false
    var errorMessage: String?

    private let authClient: SupabaseAuthClient

    init(authClient: SupabaseAuthClient) {
        self.authClient = authClient
    }

    func signIn() async -> Bool {
        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }
        do {
            try await authClient.signIn(email: email, password: password)
            return true
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

struct LoginView: View {
    @State private var viewModel: LoginViewModel
    var onSignedIn: () -> Void

    init(authClient: SupabaseAuthClient, onSignedIn: @escaping () -> Void) {
        _viewModel = State(initialValue: LoginViewModel(authClient: authClient))
        self.onSignedIn = onSignedIn
    }

    var body: some View {
        VStack(spacing: 16) {
            Text("Moniq")
                .font(.largeTitle.weight(.semibold))

            TextField("Email", text: $viewModel.email)
                .textContentType(.username)
                .keyboardType(.emailAddress)
                .autocapitalization(.none)
                .textFieldStyle(.roundedBorder)

            SecureField("Password", text: $viewModel.password)
                .textContentType(.password)
                .textFieldStyle(.roundedBorder)

            if let errorMessage = viewModel.errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(MoniqColor.destructive)
            }

            Button {
                Task {
                    if await viewModel.signIn() {
                        onSignedIn()
                    }
                }
            } label: {
                if viewModel.isSubmitting {
                    ProgressView()
                } else {
                    Text("Sign in")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(viewModel.email.isEmpty || viewModel.password.isEmpty || viewModel.isSubmitting)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(MoniqColor.background)
    }
}
