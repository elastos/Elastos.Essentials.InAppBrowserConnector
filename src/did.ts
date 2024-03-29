import type { JSONObject, VerifiableCredential, VerifiablePresentation } from "@elastosfoundation/did-js-sdk";
import { DID } from "@elastosfoundation/elastos-connectivity-sdk-js";
import { context } from "./context";
import { essentialsBridge } from "./essentialsbridge";
import { IntentEntity } from "./intent/intent";
import { IntentType } from "./intent/intent-type";
import { processIntentResponse, registerIntentResponseProcessor } from "./response-processor";

/**
 * IMPORTANT NOTE: This internal essentials connector must NOT use the DID JS SDK and Connectivity SDK
 * classes directly because otherwise this conflicst with those SDKs imported by the running apps. If
 * multiple versions of those SDKs are in use in the same webview, webpack loader mixes SDK classes in a wrong
 * way, and type checks such as "myVar instanceof DID" sometimes works, sometimes doesn't, because there are
 * multiple versions of the "DID" class that are actually not "the same".
 *
 * So the trick to access DID SDK and Connectivity SDK methods here is to make the connectivity SDK provide
 * references to those modules, loaded from the main app bundle, and use them in this connector without bundling
 * anything.
 */
export class DIDOperations {
  static registerResponseProcessors() {
    registerIntentResponseProcessor(IntentType.REQUEST_CREDENTIALS, DIDOperations.processRequestCredentialsResponse);
    registerIntentResponseProcessor(IntentType.IMPORT_CREDENTIALS, DIDOperations.processImportCredentialsResponse);
  }

  public static async getCredentials(query: DID.GetCredentialsQuery): Promise<VerifiablePresentation> {
    console.log("getCredentials request received", query);

    let response = await essentialsBridge.postMessage<any>("elastos_getCredentials", query);
    console.log("getCredentials response received", response);

    return context.didSdk.VerifiablePresentation.parse(JSON.stringify(response));
  }

  public static async requestCredentials(request: DID.CredentialDisclosureRequest): Promise<VerifiablePresentation> {
    console.log("requestCredentials request received", request);

    let response = await this.postEssentialsUrlIntent<{ presentation: string }>(
      "https://did.elastos.net/requestcredentials",
      {
        request
      }
    );

    console.log("requestCredentials response received", response);
    if (!response || !response.presentation) {
      console.warn("Missing presentation. The operation was maybe cancelled.", response);
      return null;
    }

    return context.didSdk.VerifiablePresentation.parse(response.presentation);
  }

  public static async requestCredentialsV2(requestId: string, request: DID.CredentialDisclosureRequest): Promise<void> {
    void this.processRequestCredentials(requestId, request);
    return await null;
  }

  static async processRequestCredentials(requestId: string, request: DID.CredentialDisclosureRequest) {
    let vp = await this.requestCredentials(request);

    const intentEntity: IntentEntity = {
      id: requestId,
      type : IntentType.REQUEST_CREDENTIALS,
      requestPayload: {
        caller: this.getApplicationDID(),
        requestId: requestId
      },
      responsePayload: vp
    }

    processIntentResponse(intentEntity);
  }

  static async processRequestCredentialsResponse(intent: IntentEntity): Promise<VerifiablePresentation> {
    // Do nothing
    return intent.responsePayload
  }

  public static async importCredentials(credentials: VerifiableCredential[], options?: DID.ImportCredentialOptions): Promise<DID.ImportedCredential[]> {
    console.log("importCredentials request received", credentials, options);

    let query = {
      credentials: credentials.map(c => JSON.parse(c.toString()))
    };

    if (options && options.forceToPublishCredentials)
      query["forceToPublishCredentials"] = true;

    let response = await this.postEssentialsUrlIntent<{ importedcredentials: string[] }>(
      "https://did.elastos.net/credimport",
      query
    );

    console.log("importCredentials response received", response);

    if (!response || !response.importedcredentials || !(response.importedcredentials instanceof Array)) {
      console.warn("Missing result data. The operation was maybe cancelled.", response);
      return null;
  }

    let importedCredentials: DID.ImportedCredential[];
    importedCredentials = response.importedcredentials.map(credentialUrl => {
      return {
        id: context.didSdk.DIDURL.from(credentialUrl)
      }
    });

    return importedCredentials;
  }

  static async importCredentialsV2(requestId: string, credentials: VerifiableCredential[], options?: DID.ImportCredentialOptions): Promise<void> {
    void this.processImportCredentials(requestId, credentials);
    return await null;
  }

  static async processImportCredentials(requestId: string, credentials: VerifiableCredential[], options?: DID.ImportCredentialOptions) {
    let importedCredentials = await this.importCredentials(credentials);

    const intentEntity: IntentEntity = {
      id: requestId,
      type : IntentType.IMPORT_CREDENTIALS,
      requestPayload: {
        caller: this.getApplicationDID(),
        requestId: requestId
      },
      responsePayload: importedCredentials
    }

    processIntentResponse(intentEntity);
  }

  static async processImportCredentialsResponse(intent: IntentEntity): Promise<DID.ImportedCredential[]> {
    // Do nothing
    return intent.responsePayload;
  }

  public static async signData(data: string, jwtExtra?: any, signatureFieldName?: string): Promise<DID.SignedData> {
    console.log("signData request received", data, jwtExtra, signatureFieldName);

    let response = await essentialsBridge.postMessage<DID.SignedData>("elastos_signData", {
      data, jwtExtra, signatureFieldName
    });
    console.log("signData response received", response);
    return response;
  }

  public static async deleteCredentials(credentialIds: string[], options?: DID.DeleteCredentialOptions): Promise<string[]> {
    console.log("deleteCredentials request received", credentialIds, options);

    let response = await this.postEssentialsUrlIntent<{ deletedcredentialsids: string[] }>(
      "https://did.elastos.net/creddelete",
      {
        credentialsids: credentialIds,
        options
      }
    );
    console.log("deleteCredentials response received", response);

    if (!response || !response.deletedcredentialsids) {
      return null;
    }

    return response.deletedcredentialsids;
  }

  public static async generateAppIdCredential(appInstanceDID: string, appDID: string): Promise<VerifiableCredential> {
    console.log("generateAppIdCredential request received", appInstanceDID, appDID);

    let response = await this.postEssentialsUrlIntent<{ credential: string }>(
      "https://did.elastos.net/appidcredissue",
      {
        appinstancedid: appInstanceDID,
        appdid: appDID
      }
    );
    console.log("generateAppIdCredential response received", response);

    if (!response || !response.credential) {
      return null;
    }

    return context.didSdk.VerifiableCredential.parse(response.credential);
  }

  public static async updateHiveVaultAddress?(vaultAddress: string, displayName: string): Promise<DID.UpdateHiveVaultAddressStatus> {
    console.log("updateHiveVaultAddress request received", vaultAddress, displayName);

    let response = await this.postEssentialsUrlIntent<{ status: DID.UpdateHiveVaultAddressStatus }>(
      "https://did.elastos.net/sethiveprovider",
      {
        address: vaultAddress,
        name: displayName
      }
    );
    console.log("updateHiveVaultAddress response received", response);

    if (!response || !response.status) {
      return null;
    }

    return response.status;
  }

  public static async issueCredential(holder: string, types: string[], subject: JSONObject, identifier?: string, expirationDate?: string): Promise<VerifiableCredential> {
    console.log("issueCredential request received", holder, types, subject, identifier, expirationDate);

    let response = await this.postEssentialsUrlIntent<{ credential: string }>(
      "https://did.elastos.net/credissue",
      {
        subjectdid: holder,
        types,
        properties: subject,
        identifier,
        expirationDate
      }
    );
    console.log("issueCredential response received", response);

    if (!response || !response.credential) {
      return null;
    }

    return context.didSdk.VerifiableCredential.parse(response.credential);
  }

  public static async generateHiveBackupCredential(sourceHiveNodeDID: string, targetHiveNodeDID: string, targetNodeURL: string): Promise<VerifiableCredential> {
    console.log("generateHiveBackupCredential request received", sourceHiveNodeDID, targetHiveNodeDID, targetNodeURL);

    let response = await this.postEssentialsUrlIntent<{ credential: string }>(
      "https://did.elastos.net/hivebackupcredissue",
      {
        sourceHiveNodeDID,
        targetHiveNodeDID,
        targetNodeURL
      }
    );
    console.log("generateHiveBackupCredential response received", response);

    if (!response || !response.credential) {
      return null;
    }

    return context.didSdk.VerifiableCredential.parse(response.credential);
  }

  private static async postEssentialsUrlIntent<T>(url: string, params: any): Promise<T> {
    // Append informative caller information to the intent, if available.
    let caller = this.getApplicationDID();
    if (caller) {
      params["caller"] = caller;
    }

    return essentialsBridge.postMessage<T>("elastos_essentials_url_intent", {
      url,
      params
    });
  }

  private static getApplicationDID() {
    // getApplicationDID() throws an error if called when no app did has been set.
    try {
      return context.connectivity.getApplicationDID();
    }
    catch {
      // Silent catch, it's ok
    }
  }
}