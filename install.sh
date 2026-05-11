#!/usr/bin/env bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DEFAULT_SYSTEM_INSTALL_DIR="/usr/local/bin"
DEFAULT_USER_INSTALL_DIR="$HOME/.local/bin"
INSTALL_DIR="${SIGNAL_EXECUTOR_INSTALL_DIR:-}"
INSTALL_DIR_EXPLICIT=0
DATA_DIR="$HOME/.signal-executor"
SERVICE_PORT="${SIGNAL_EXECUTOR_PORT:-38182}"
BINARY_NAME="signal-executor"
PROFILE_NAME="${SIGNAL_EXECUTOR_PROFILE:-}"
EXCHANGE="${SIGNAL_EXECUTOR_EXCHANGE:-}"
RELEASE_MANIFEST_URL="${SIGNAL_EXECUTOR_MANIFEST_URL:-https://signal.horse/api/releases/latest}"
LEGACY_RELEASE_BASE_URL="${SIGNAL_EXECUTOR_RELEASE_BASE_URL:-https://signal.horse/releases/latest}"
RELEASE_MANIFEST_JSON=""
AUTO_CONFIRM=0
NON_INTERACTIVE=0
SKIP_CREDENTIALS=0
INSTALL_SERVICE_MODE="prompt"
SUDO=""

if [[ -n "$INSTALL_DIR" ]]; then
    INSTALL_DIR_EXPLICIT=1
fi

usage() {
    cat <<'EOF'
Usage: install.sh [options]

Options:
  -y, --yes               Skip the initial installation confirmation prompt.
  --non-interactive       Avoid interactive yes/no prompts. Defaults to installing the service.
  --skip-credentials      Do not onboard exchange credentials during installation.
  --install-service       Install and start the local background service without prompting.
  --no-service            Do not install the local background service.
  --exchange <name>       Exchange to use for credential onboarding.
  --profile <name>        Credential profile name to use for onboarding.
  --install-dir <path>    Install directory for the binary.
  --port <number>         Port for the local Signal Executor service.
  -h, --help              Show this help message.
EOF
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            -y|--yes)
                AUTO_CONFIRM=1
                shift
                ;;
            --non-interactive)
                NON_INTERACTIVE=1
                AUTO_CONFIRM=1
                shift
                ;;
            --skip-credentials)
                SKIP_CREDENTIALS=1
                shift
                ;;
            --install-service)
                INSTALL_SERVICE_MODE="yes"
                shift
                ;;
            --no-service)
                INSTALL_SERVICE_MODE="no"
                shift
                ;;
            --exchange)
                EXCHANGE="$2"
                shift 2
                ;;
            --profile)
                PROFILE_NAME="$2"
                shift 2
                ;;
            --install-dir)
                INSTALL_DIR="$2"
                INSTALL_DIR_EXPLICIT=1
                shift 2
                ;;
            --port)
                SERVICE_PORT="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                usage
                exit 1
                ;;
        esac
    done

    if [[ "$NON_INTERACTIVE" -eq 1 && "$INSTALL_SERVICE_MODE" == "prompt" ]]; then
        INSTALL_SERVICE_MODE="yes"
    fi
}

resolve_install_dir() {
    if [[ "$INSTALL_DIR_EXPLICIT" -eq 1 ]]; then
        return
    fi

    if [[ "$EUID" -eq 0 ]]; then
        INSTALL_DIR="$DEFAULT_SYSTEM_INSTALL_DIR"
        return
    fi

    if [[ "$NON_INTERACTIVE" -eq 1 ]]; then
        INSTALL_DIR="$DEFAULT_USER_INSTALL_DIR"
        return
    fi

    if ! command -v sudo >/dev/null 2>&1; then
        INSTALL_DIR="$DEFAULT_USER_INSTALL_DIR"
        return
    fi

    INSTALL_DIR="$DEFAULT_SYSTEM_INSTALL_DIR"
}

validate_exchange() {
    case "$1" in
        okx|binance|bitget|gate|bybit)
            ;;
        *)
            echo -e "${RED}Unsupported exchange: $1${NC}"
            exit 1
            ;;
    esac
}

detect_platform() {
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    ARCH=$(uname -m)

    case "$OS" in
        linux)
            case "$ARCH" in
                x86_64) PLATFORM="linux-amd64" ;;
                aarch64|arm64) PLATFORM="linux-arm64" ;;
                *) echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
            esac
            ;;
        darwin)
            case "$ARCH" in
                x86_64) PLATFORM="darwin-amd64" ;;
                arm64) PLATFORM="darwin-arm64" ;;
                *) echo -e "${RED}Unsupported architecture: $ARCH${NC}"; exit 1 ;;
            esac
            ;;
        *)
            echo -e "${RED}Unsupported OS: $OS${NC}"
            exit 1
            ;;
    esac
}

print_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║       Signal Executor - Local Mode Installer               ║"
    echo "║   Keyring-backed credentials and local background service  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_sudo() {
    if [[ "$EUID" -eq 0 ]]; then
        SUDO=""
        return
    fi

    if [[ "$INSTALL_DIR" == "$HOME" || "$INSTALL_DIR" == "$HOME/"* ]]; then
        SUDO=""
        return
    fi

    if [[ -d "$INSTALL_DIR" && -w "$INSTALL_DIR" ]]; then
        SUDO=""
        return
    fi

    if [[ ! -e "$INSTALL_DIR" && -w "$(dirname "$INSTALL_DIR")" ]]; then
        SUDO=""
        return
    fi

    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
        echo -e "${YELLOW}Installing to ${INSTALL_DIR} requires sudo access.${NC}"
    else
        echo -e "${RED}Installing to ${INSTALL_DIR} requires elevated privileges, and sudo is not available.${NC}"
        echo -e "${YELLOW}Use --install-dir ${DEFAULT_USER_INSTALL_DIR} or rerun with a writable destination.${NC}"
        exit 1
    fi
}

command_hint() {
    if command -v signal-executor >/dev/null 2>&1; then
        printf 'signal-executor'
    else
        printf '%s/%s' "$INSTALL_DIR" "$BINARY_NAME"
    fi
}

confirm_installation() {
    if [[ "$AUTO_CONFIRM" -eq 1 ]]; then
        return
    fi

    read -r -p "Proceed with installation? [Y/n] " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
}

download_text() {
    local url="$1"

    if command -v curl >/dev/null 2>&1; then
        curl -fsSL "$url"
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- "$url"
    else
        echo -e "${RED}Need curl or wget to download Signal Horse release metadata.${NC}" >&2
        exit 1
    fi
}

fetch_release_manifest() {
    if [[ -n "$RELEASE_MANIFEST_JSON" ]]; then
        return
    fi

    if ! RELEASE_MANIFEST_JSON=$(download_text "$RELEASE_MANIFEST_URL"); then
        echo -e "${YELLOW}Failed to fetch release manifest from ${RELEASE_MANIFEST_URL}. Falling back to legacy release aliases.${NC}"
        RELEASE_MANIFEST_JSON=""
    fi
}

manifest_string_value() {
    local key="$1"

    if [[ -z "$RELEASE_MANIFEST_JSON" ]]; then
        return 1
    fi

    printf '%s\n' "$RELEASE_MANIFEST_JSON" | sed -n 's/.*"'"$key"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1
}

legacy_download_url() {
    case "$1" in
        linux-amd64)
            printf '%s/signal-executor-linux-amd64' "$LEGACY_RELEASE_BASE_URL"
            ;;
        linux-arm64)
            printf '%s/signal-executor-linux-arm64' "$LEGACY_RELEASE_BASE_URL"
            ;;
        darwin-amd64)
            printf '%s/signal-executor-darwin-amd64' "$LEGACY_RELEASE_BASE_URL"
            ;;
        darwin-arm64)
            printf '%s/signal-executor-darwin-arm64' "$LEGACY_RELEASE_BASE_URL"
            ;;
        *)
            return 1
            ;;
    esac
}

resolve_download_url() {
    local key=""
    local manifest_url=""

    fetch_release_manifest

    case "$1" in
        linux-amd64)
            key="linuxAmd64BinaryUrl"
            ;;
        darwin-amd64)
            key="macosAmd64BinaryUrl"
            ;;
        darwin-arm64)
            key="macosArm64BinaryUrl"
            ;;
    esac

    if [[ -n "$key" ]]; then
        manifest_url=$(manifest_string_value "$key" || true)
        if [[ -n "$manifest_url" ]]; then
            printf '%s' "$manifest_url"
            return 0
        fi
    fi

    legacy_download_url "$1"
}

download_binary() {
    echo -e "${BLUE}Installing Signal Executor binary...${NC}"

    LOCAL_BINARY="/home/ubuntu/signal_executor/rust_executor/target/release/signal_executor"

    $SUDO mkdir -p "${INSTALL_DIR}"

    if [[ -f "$LOCAL_BINARY" ]]; then
        echo -e "${YELLOW}Using local binary build.${NC}"
        $SUDO cp "$LOCAL_BINARY" "${INSTALL_DIR}/${BINARY_NAME}"
    elif [[ -f "./target/release/signal_executor" ]]; then
        echo -e "${YELLOW}Using local build from current directory.${NC}"
        $SUDO cp "./target/release/signal_executor" "${INSTALL_DIR}/${BINARY_NAME}"
    else
        DOWNLOAD_URL=$(resolve_download_url "$PLATFORM")
        temp_file=$(mktemp)
        if command -v curl >/dev/null 2>&1; then
            curl -fsSL "$DOWNLOAD_URL" -o "$temp_file"
        elif command -v wget >/dev/null 2>&1; then
            wget -q "$DOWNLOAD_URL" -O "$temp_file"
        else
            echo -e "${RED}Need curl or wget to download the binary.${NC}"
            exit 1
        fi
        $SUDO mv "$temp_file" "${INSTALL_DIR}/${BINARY_NAME}"
    fi

    $SUDO chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    echo -e "${GREEN}Binary installed to ${INSTALL_DIR}/${BINARY_NAME}${NC}"
}

prepare_local_data_dir() {
    mkdir -p "$DATA_DIR"
    chmod 700 "$DATA_DIR"
}

select_exchange() {
    if [[ "$SKIP_CREDENTIALS" -eq 1 ]]; then
        EXCHANGE=""
        return
    fi

    if [[ -n "$EXCHANGE" ]]; then
        EXCHANGE=$(printf '%s' "$EXCHANGE" | tr '[:upper:]' '[:lower:]')
        validate_exchange "$EXCHANGE"
        echo -e "${GREEN}Using exchange: ${EXCHANGE}${NC}"
        return
    fi

    echo ""
    echo -e "${CYAN}Select the exchange for the local profile:${NC}"
    echo "  1) OKX"
    echo "  2) Binance"
    echo "  3) Bitget"
    echo "  4) Gate.io"
    echo "  5) Bybit"

    while true; do
        read -r -p "Enter choice [1-5]: " choice
        case "$choice" in
            1) EXCHANGE="okx"; break ;;
            2) EXCHANGE="binance"; break ;;
            3) EXCHANGE="bitget"; break ;;
            4) EXCHANGE="gate"; break ;;
            5) EXCHANGE="bybit"; break ;;
            *) echo -e "${RED}Invalid choice. Please enter 1-5.${NC}" ;;
        esac
    done
}

select_profile() {
    local default_profile

    if [[ "$SKIP_CREDENTIALS" -eq 1 ]]; then
        PROFILE_NAME=""
        return
    fi

    if [[ -n "$PROFILE_NAME" ]]; then
        echo -e "${GREEN}Using local credential profile: ${PROFILE_NAME}${NC}"
        return
    fi

    default_profile="${EXCHANGE}-main"
    echo ""
    read -r -p "Profile name [${default_profile}]: " PROFILE_NAME
    PROFILE_NAME="${PROFILE_NAME:-$default_profile}"
    echo -e "${GREEN}Using local credential profile: ${PROFILE_NAME}${NC}"
}

configure_credentials() {
    local command_bin

    command_bin=$(command_hint)

    if [[ "$SKIP_CREDENTIALS" -eq 1 ]]; then
        echo ""
        echo -e "${YELLOW}Skipping credential onboarding. Run '${command_bin} credentials set' later before trading.${NC}"
        return
    fi

    echo ""
    echo -e "${BLUE}Open the local keyring onboarding flow.${NC}"
    echo -e "${YELLOW}The binary will prompt for API key / secret and store them in the OS keyring.${NC}"

    while true; do
        "${INSTALL_DIR}/${BINARY_NAME}" credentials set --profile "$PROFILE_NAME" --exchange "$EXCHANGE"

        if "${INSTALL_DIR}/${BINARY_NAME}" credentials test --profile "$PROFILE_NAME"; then
            echo -e "${GREEN}Credential profile ${PROFILE_NAME} validated successfully.${NC}"
            break
        fi

        echo ""
        read -r -p "Credential validation failed. Retry onboarding? [Y/n] " retry
        if [[ "$retry" =~ ^[Nn]$ ]]; then
            echo -e "${YELLOW}Continuing without a validated profile. You can rerun 'signal-executor credentials set/test' later.${NC}"
            break
        fi
    done
}

install_service() {
    local command_bin
    local should_install="yes"

    command_bin=$(command_hint)

    case "$INSTALL_SERVICE_MODE" in
        yes)
            should_install="yes"
            ;;
        no)
            should_install="no"
            ;;
        prompt)
            echo ""
            read -r -p "Install Signal Executor as a local background service? [Y/n] " install_service_prompt
            if [[ "$install_service_prompt" =~ ^[Nn]$ ]]; then
                should_install="no"
            fi
            ;;
    esac

    if [[ "$should_install" == "no" ]]; then
        echo -e "${YELLOW}Skipping service install. Start manually with: ${command_bin} serve --port ${SERVICE_PORT}${NC}"
        return
    fi

    "${INSTALL_DIR}/${BINARY_NAME}" service install --start --binary "${INSTALL_DIR}/${BINARY_NAME}" --port "$SERVICE_PORT"

    if [[ "$OS" == "linux" ]]; then
        enable_linux_linger
    fi

    echo -e "${GREEN}Service installed and started.${NC}"
}

enable_linux_linger() {
    local target_user
    local linger_state

    if ! command -v loginctl >/dev/null 2>&1; then
        echo -e "${YELLOW}Boot persistence note:${NC} loginctl is not available, so linger could not be enabled automatically."
        return
    fi

    target_user=$(id -un)

    linger_state=$(loginctl show-user "$target_user" --property=Linger --value 2>/dev/null || true)
    if [[ "$linger_state" == "yes" ]]; then
        echo -e "${GREEN}Boot persistence already enabled for ${target_user}.${NC}"
        return
    fi

    echo -e "${BLUE}Enabling boot persistence for ${target_user}...${NC}"

    if [[ "$EUID" -eq 0 ]]; then
        if loginctl enable-linger "$target_user" >/dev/null 2>&1; then
            echo -e "${GREEN}Boot persistence enabled for ${target_user}.${NC}"
            return
        fi
    elif command -v sudo >/dev/null 2>&1; then
        if sudo loginctl enable-linger "$target_user" >/dev/null 2>&1; then
            echo -e "${GREEN}Boot persistence enabled for ${target_user}.${NC}"
            return
        fi
    fi

    echo -e "${YELLOW}Boot persistence note:${NC} Failed to enable linger automatically. If this machine reboots without a user login, run: sudo loginctl enable-linger ${target_user}"
}

print_completion() {
    local command_bin
    local testnet_payload=""

    command_bin=$(command_hint)

    if [[ -n "$EXCHANGE" && -n "$PROFILE_NAME" ]]; then
        testnet_payload=$(printf '{"exchange":"%s","asset_type":"swap","symbol":"BTCUSDT","side":"buy","quantity":"0.001","leverage":3,"credential_profile":"%s","testnet":true}' "$EXCHANGE" "$PROFILE_NAME")
    fi

    echo ""
    echo -e "${GREEN}Installation complete.${NC}"
    echo -e "${GREEN}Binary:${NC} ${INSTALL_DIR}/${BINARY_NAME}"
    echo -e "${GREEN}Data dir:${NC} ${DATA_DIR}"
    echo -e "${GREEN}Port:${NC} ${SERVICE_PORT}"

    if [[ -n "$PROFILE_NAME" ]]; then
        echo -e "${GREEN}Profile:${NC} ${PROFILE_NAME}"
    fi

    echo ""
    echo -e "${CYAN}Useful commands:${NC}"

    if [[ -n "$PROFILE_NAME" ]]; then
        echo "  ${command_bin} doctor --profile ${PROFILE_NAME}"
    else
        echo "  ${command_bin} doctor"
        echo "  ${command_bin} credentials set --profile <profile-name> --exchange <exchange>"
        echo "  ${command_bin} credentials test --profile <profile-name>"
    fi

    echo "  ${command_bin} service status"
    echo "  ${command_bin} service restart"
    echo "  curl -fsS http://127.0.0.1:${SERVICE_PORT}/health"

    if [[ -n "$testnet_payload" ]]; then
        echo ""
        echo -e "${CYAN}Example testnet request:${NC}"
        echo "curl -fsS -X POST http://127.0.0.1:${SERVICE_PORT}/order -H 'Content-Type: application/json' -d '${testnet_payload}'"
    else
        echo ""
        echo -e "${YELLOW}Next step:${NC} onboard credentials before sending trade requests."
    fi

    if [[ ":$PATH:" != *":${INSTALL_DIR}:"* ]]; then
        echo ""
        echo -e "${YELLOW}PATH note:${NC} ${INSTALL_DIR} is not on PATH in this shell. Use ${command_bin} directly or add it to PATH."
    fi

    if [[ "$OS" == "linux" ]]; then
        echo ""
        echo -e "${CYAN}Remote access:${NC}"
        echo "  Web UI: http://<server-ip>:${SERVICE_PORT}/"
        echo "  API:    http://<server-ip>:${SERVICE_PORT}"
        echo -e "${YELLOW}Firewall note:${NC} Open TCP port ${SERVICE_PORT} on the Linux host if you want to access the Rust Executor UI from another machine."
    fi
}

main() {
    parse_args "$@"
    print_banner
    detect_platform
    resolve_install_dir
    check_sudo
    confirm_installation

    download_binary
    prepare_local_data_dir
    select_exchange
    select_profile
    configure_credentials
    install_service
    print_completion
}

main "$@"