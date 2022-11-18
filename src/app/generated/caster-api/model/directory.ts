/*
Copyright 2021 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
*/

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
import { Design } from './design';
import { Workspace } from './workspace';


export interface Directory { 
    /**
     * Id of the directory.
     */
    id?: string;
    /**
     * Name of the directory.
     */
    name?: string | null;
    /**
     * Id of the project this directory is under.
     */
    projectId?: string;
    /**
     * Optional Id of the directory this directory is under
     */
    parentId?: string | null;
    /**
     * List of files in the directory. Null if not requested
     */
    files?: Array<any> | null;
    /**
     * List of workspaces in the directory. Null if not requested
     */
    workspaces?: Array<Workspace> | null;
    /**
     * List of designs in the directory. Null if not requested
     */
    designs?: Array<Design> | null;
    /**
     * The version of Terraform that will be set Workspaces created in this Directory.  If not set, will traverse parents until a version is found.  If still not set, the default version will be used.
     */
    terraformVersion?: string | null;
}

