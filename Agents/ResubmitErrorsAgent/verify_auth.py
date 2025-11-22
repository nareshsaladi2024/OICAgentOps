
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import google.auth
from google.auth.transport.requests import Request

def verify_auth():
    print("Verifying authentication setup...")
    
    # 1. Load .env
    env_path = Path(__file__).parent / '.env'
    print(f"Loading .env from: {env_path}")
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
        print("✅ .env file found and loaded")
    else:
        print("❌ .env file NOT found")
        
    # 2. Check Service Account File
    service_account_path = Path(__file__).parent / 'service_account.json'
    print(f"Checking service_account.json at: {service_account_path}")
    
    if service_account_path.exists():
        print("✅ service_account.json found")
        # Set env var explicitly as we did in the fix
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(service_account_path.absolute())
        print(f"Set GOOGLE_APPLICATION_CREDENTIALS to: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")
    else:
        print("⚠️ service_account.json NOT found in agent directory")
        if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
            print(f"Using existing GOOGLE_APPLICATION_CREDENTIALS: {os.environ['GOOGLE_APPLICATION_CREDENTIALS']}")
        else:
            print("❌ No GOOGLE_APPLICATION_CREDENTIALS set and file not found")

    # 3. Try to authenticate
    print("\nAttempting to load credentials...")
    try:
        credentials, project = google.auth.default(
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        print(f"✅ Credentials loaded successfully")
        print(f"   Project ID: {project}")
        print(f"   Service Account Email: {getattr(credentials, 'service_account_email', 'N/A')}")
        
        # Optional: Verify token refresh (checks if keys are actually valid)
        # print("Refreshing token to verify validity...")
        # credentials.refresh(Request())
        # print("✅ Token refreshed successfully")
        
    except Exception as e:
        print(f"❌ Authentication FAILED: {e}")
        print("\nTroubleshooting tips:")
        print("1. Check if service_account.json is valid JSON")
        print("2. Check if the service account has correct permissions")

if __name__ == "__main__":
    verify_auth()
