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


export interface Workspace { 
    /**
     * A unique identifier
     */
    id?: string;
    /**
     * The Name this Workspace will be referred to by
     */
    name?: string | null;
    /**
     * The Id of the Directory that this Workspace was created in
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
    /**
     * Limit the number of concurrent operations as Terraform walks the graph.   If null, the Terraform default will be used.
     */
    parallelism?: number | null;
    /**
     * If set, the number of consecutive failed destroys in an Azure Workspace before   Caster will attempt to mitigate by removing azurerm_resource_group children from the state.
     */
    azureDestroyFailureThreshold?: number | null;
}

