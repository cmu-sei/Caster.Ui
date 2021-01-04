// Copyright 2021 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

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


export interface ModelFile { 
    /**
     * ID of the file.
     */
    id?: string;
    /**
     * Name of the file.
     */
    name?: string | null;
    /**
     * ID of the directory this file is under.
     */
    directoryId?: string;
    /**
     * An optional Workspace that this File is assigned to.
     */
    workspaceId?: string | null;
    /**
     * The full contents of the file.
     */
    content?: string | null;
    /**
     * The ID of the user who saved the file last.
     */
    modifiedById?: string | null;
    /**
     * The name of the user who saved the file last.
     */
    modifiedByName?: string | null;
    /**
     * The date the file was saved.
     */
    dateSaved?: Date | null;
    /**
     * Flag to indicate that this file has been deleted.
     */
    isDeleted?: boolean;
    /**
     * The Id of the User that currently has a lock on this File or null if unlocked
     */
    lockedById?: string | null;
    /**
     * The name of the User that currently has a lock on this File or null if unlocked
     */
    lockedByName?: string | null;
    /**
     * Only System Admins can make changes to this file while this property is true
     */
    readonly administrativelyLocked?: boolean;
}

