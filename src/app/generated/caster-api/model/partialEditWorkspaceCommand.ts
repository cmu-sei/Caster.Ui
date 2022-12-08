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


export interface PartialEditWorkspaceCommand { 
    /**
     * The Name of the Workspace
     */
    name?: string | null;
    /**
     * The Id of the Directory of the Workspace
     */
    directoryId?: string | null;
    /**
     * True if this Workspace will be dynamically assigned a Host on first Run
     */
    dynamicHost?: boolean | null;
    /**
     * The version of Terraform that will be used for Runs in this Workspace.  If null or empty, the default version will be used.
     */
    terraformVersion?: string | null;
    /**
     * Limit the number of concurrent operations as Terraform walks the graph.   If null, the Terraform default will be used.
     */
    parallelism?: number;
}

