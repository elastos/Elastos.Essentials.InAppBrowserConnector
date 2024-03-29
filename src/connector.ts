import type * as didSdk from "@elastosfoundation/did-js-sdk";
import type { JSONObject, VerifiableCredential, VerifiablePresentation } from "@elastosfoundation/did-js-sdk";
import type { DID, Interfaces, Wallet, connectivity } from "@elastosfoundation/elastos-connectivity-sdk-js";
import type { provider } from "web3-core";
import { context } from "./context";
import { DIDOperations } from "./did";
import { essentialsBridge } from "./essentialsbridge";
import { setResponseHandler } from "./response-processor";
import { UXOperations } from "./ux";

/**
 * Connector generated as a standalone JS file that can be injected into dApps opened from the
 * Essentials dApp browser. This connector is normally injected as a global window.elastos and can then
 * be found by the connectivity SDK as one of the available connectors for elastos operations.
 */
class EssentialsDABConnector /* implements Interfaces.Connectors.IConnector */ {
  public name: string = "essentialsiab";
  private alreadyRegisterConnector = false;

  constructor() {
    this.registerResponseProcessors();
  }

  async getDisplayName(): Promise<string> {
    return "Elastos Essentials In App Browser";
  }

  getWeb3Provider(): provider {
    // As we are running inside essentials, the web3 provider is injeted
    // into window.ethereum
    return (window as any).ethereum as provider;
  }

  async setModuleContext(didSdkModule: typeof didSdk, connectivityModule: typeof connectivity) {
    context.didSdk = didSdkModule;
    context.connectivity = connectivityModule;

    // For connector v2 (eg. requestCredentialsV2)
    // The registerResponseHandler is called in registerConnector.
    // There is no good place to call this api, so we keep it here.
    if (!this.alreadyRegisterConnector) {
      try {
        context.connectivity.registerConnector(this);
        this.alreadyRegisterConnector = true;
      } catch (e) {
        console.log('registerConnector error:', e)
      }
    }
  }

  private ensureContextSet() {
    if (!context.didSdk || !context.connectivity) {
      throw new Error("This dApp uses a old version of the elastos connectivity SDK and must be upgraded to be able to run inside Elastos Essentials");
    }
  }

  private registerResponseProcessors() {
      DIDOperations.registerResponseProcessors();
  }

  registerResponseHandler(handler: Interfaces.Connectors.ConnectorResponseHandler) {
      console.log("Registered response handler on the EssentialsDABConnector");
      setResponseHandler(handler);
  }

  /**
   * DID API
   */
  getCredentials(query: DID.GetCredentialsQuery): Promise<VerifiablePresentation> {
    this.ensureContextSet();
    return DIDOperations.getCredentials(query);
  }

  requestCredentials(query: DID.CredentialDisclosureRequest): Promise<VerifiablePresentation> {
    this.ensureContextSet();
    return DIDOperations.requestCredentials(query);
  }

  requestCredentialsV2(requestId: string, query: DID.CredentialDisclosureRequest): Promise<void> {
    this.ensureContextSet();
    return DIDOperations.requestCredentialsV2(requestId, query);
  }

  issueCredential(holder: string, types: string[], subject: JSONObject, identifier?: string, expirationDate?: string): Promise<VerifiableCredential> {
    this.ensureContextSet();
    return DIDOperations.issueCredential(holder, types, subject, identifier, expirationDate);
  }

  importCredentials(credentials: VerifiableCredential[], options?: DID.ImportCredentialOptions): Promise<DID.ImportedCredential[]> {
    this.ensureContextSet();
    return DIDOperations.importCredentials(credentials, options);
  }

  importCredentialsV2(requestId: string, credentials: VerifiableCredential[], options?: DID.ImportCredentialOptions): Promise<void> {
    this.ensureContextSet();
    return DIDOperations.importCredentialsV2(requestId, credentials, options);
  }

  signData(data: string, jwtExtra?: any, signatureFieldName?: string): Promise<DID.SignedData> {
    this.ensureContextSet();
    return DIDOperations.signData(data, jwtExtra, signatureFieldName);
  }

  deleteCredentials(credentialIds: string[], options?: DID.DeleteCredentialOptions): Promise<string[]> {
    this.ensureContextSet();
    return DIDOperations.deleteCredentials(credentialIds, options);
  }

  requestPublish(): Promise<string> {
    // OK. Normally never used, could become deprecated soon, we don't implement for now.
    throw new Error("Method not implemented.");
  }

  generateAppIdCredential(appInstanceDID: string, appDID: string): Promise<any> {
    this.ensureContextSet();
    return DIDOperations.generateAppIdCredential(appInstanceDID, appDID);
  }

  updateHiveVaultAddress(vaultAddress: string, displayName: string): Promise<DID.UpdateHiveVaultAddressStatus> {
    this.ensureContextSet();
    return DIDOperations.updateHiveVaultAddress(vaultAddress, displayName);
  }

  importCredentialContext(serviceName: string, contextCredential: VerifiableCredential): Promise<DID.ImportedCredential> {
    // Ok for now, only used by the credential toolbox, not supposed to be used on mobile.
    throw new Error("importCredentialContext(): Method not implemented.");
  }

  generateHiveBackupCredential(sourceHiveNodeDID: string, targetHiveNodeDID: string, targetNodeURL: string): Promise<VerifiableCredential> {
    this.ensureContextSet();
    return DIDOperations.generateHiveBackupCredential(sourceHiveNodeDID, targetHiveNodeDID, targetNodeURL);
  }

  pay(query: any): Promise<Wallet.TransactionResult> {
    throw new Error("Method not implemented.");
  }

  voteForDPoS(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  voteForCRCouncil(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  voteForCRProposal(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  sendSmartContractTransaction(payload: any): Promise<string> {
    throw new Error("Method not implemented.");
  }

  /**
   * UI API
   */
  onBoard(feature: string, title: string, introduction: string, button: string): Promise<void> {
    return UXOperations.onBoard(feature, title, introduction, button);
  }

  public sendResponse(id: number, result: any): void {
    essentialsBridge.sendResponse(id, result);
  }

  public sendError(id: number, error: string) {
    essentialsBridge.sendError(id, error);
  }
}

// Expose this class globally to be able to create instances from the browser dApp.
window["EssentialsDABConnector"] = EssentialsDABConnector;