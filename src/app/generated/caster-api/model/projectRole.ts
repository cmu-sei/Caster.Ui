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
import { ProjectPermission } from './projectPermission';


export interface ProjectRole { 
    id?: string;
    name?: string | null;
    allPermissions?: boolean;
    permissions?: Array<ProjectPermission> | null;
}

