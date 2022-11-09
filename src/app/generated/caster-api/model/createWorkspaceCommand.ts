/**
 * Caster API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1.1.0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


export interface CreateWorkspaceCommand { 
    /**
     * The Name of the Workspace
     */
    name?: string | null;
    /**
     * The Id of the Directory of the Workspace
     */
    directoryId?: string;
    /**
     * True if this Workspace will be dynamically assigned a Host on first Run
     */
    dynamicHost?: boolean;
    /**
     * The version of Terraform that will be used for Runs in this Workspace.  If null or empty, the default version will be used.
     */
    terraformVersion?: string | null;
}

