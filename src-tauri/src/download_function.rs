use reqwest::blocking::Client;
use reqwest::header::{ACCEPT_RANGES, CONTENT_LENGTH, RANGE};
use std::error::Error;
use std::fs::File;
use std::io::{self, Read, Write};
use std::sync::Arc;
use std::thread;
use indicatif::{ProgressBar, ProgressStyle};

/// Downloads a file from the given `url` to the specified `output` file using `num_threads` threads.
/// A progress bar is displayed to show the download progress.
///
/// # Arguments
///
/// * `url` - The URL of the file to download.
/// * `output` - The path to the output file.
/// * `num_threads` - The number of threads to use for downloading.
///
/// # Returns
///
/// A `Result` which is `Ok(())` if the download succeeds or an error if something goes wrong.
#[tauri::command()]
pub fn download_file(url: &str, output: &str, numthreads: usize) -> Result<(), String> {
    // Wrap the existing implementation in a conversion to String errors
    (|| -> Result<(), Box<dyn Error + Send + Sync>> {
        // Create a blocking HTTP client.
        let client = Client::new();

        // Issue a HEAD request to determine file size and check for range support.
        let head_resp = client.head(url).send()?;
        if !head_resp.status().is_success() {
            return Err(format!("HEAD request failed with status: {}", head_resp.status()).into());
        }
        let headers = head_resp.headers();
        let total_size = if let Some(len) = headers.get(CONTENT_LENGTH) {
            len.to_str()?.parse::<u64>()?
        } else {
            return Err("Could not get content length from server".into());
        };

        // Check if the server supports range requests.
        let accept_ranges = headers
            .get(ACCEPT_RANGES)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if accept_ranges != "bytes" {
            eprintln!("Server does not support range requests. Falling back to single-threaded download.");
            let mut resp = client.get(url).send()?;
            let mut out_file = File::create(output)?;
            io::copy(&mut resp, &mut out_file)?;
            println!("Downloaded {} bytes.", total_size);
            return Ok(());
        }

        println!("Downloading {} bytes using {} threads...", total_size, numthreads);

        // Create and configure the progress bar.
        let pb = Arc::new(ProgressBar::new(total_size));
        pb.set_style(
            ProgressStyle::default_bar()
                .template("{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {bytes}/{total_bytes} ({eta})")?
                .progress_chars("#>-"),
        );

        // Calculate byte ranges for each thread.
        let chunk_size = total_size / numthreads as u64;
        let mut ranges = Vec::new();
        for i in 0..numthreads {
            let start = i as u64 * chunk_size;
            let end = if i == numthreads - 1 {
                total_size - 1
            } else {
                (i as u64 + 1) * chunk_size - 1
            };
            ranges.push((start, end));
        }

        // Spawn threads to download each chunk.
        let mut handles = Vec::new();
        let url_string = url.to_string();
        for (start, end) in ranges {
            let url_clone = url_string.clone();
            let client_clone = Client::new(); // New client for each thread.
            let pb_clone = Arc::clone(&pb);
            let handle = thread::spawn(move || -> Result<(u64, Vec<u8>), Box<dyn Error + Send + Sync>> {
                let max_retries = 3;
                let mut attempt = 0;
                loop {
                    attempt += 1;
                    let range_header = format!("bytes={}-{}", start, end);
                    let response = client_clone
                        .get(&url_clone)
                        .header(RANGE, range_header.clone())
                        .send();
                    match response {
                        Err(e) => {
                            if e.to_string().contains("IncompleteMessage") && attempt < max_retries {
                                eprintln!(
                                    "Attempt {} for range {}-{} failed with incomplete message, retrying...",
                                    attempt, start, end
                                );
                                continue;
                            } else {
                                return Err(e.into());
                            }
                        }
                        Ok(mut resp) => {
                            if !resp.status().is_success() && resp.status() != reqwest::StatusCode::PARTIAL_CONTENT {
                                if attempt >= max_retries {
                                    return Err(format!(
                                        "Failed to download range {}-{} after {} attempts",
                                        start, end, attempt
                                    ).into());
                                }
                                continue;
                            }
                            // Read the response in chunks and update the progress bar.
                            let mut chunk = Vec::with_capacity((end - start + 1) as usize);
                            let mut buffer = [0u8; 8192];
                            loop {
                                let n = match resp.read(&mut buffer) {
                                    Ok(n) => n,
                                    Err(e) => {
                                        if e.to_string().contains("IncompleteMessage") && attempt < max_retries {
                                            eprintln!(
                                                "Attempt {} for range {}-{} encountered error reading data, retrying...",
                                                attempt, start, end
                                            );
                                            break; // Break inner loop to retry.
                                        } else {
                                            return Err(e.into());
                                        }
                                    }
                                };
                                if n == 0 {
                                    // Finished reading this range.
                                    break;
                                }
                                chunk.extend_from_slice(&buffer[..n]);
                                pb_clone.inc(n as u64);
                            }
                            return Ok((start, chunk));
                        }
                    }
                }
            });
            handles.push(handle);
        }

        // Allocate a buffer for the full file.
        let mut file_data = vec![0u8; total_size as usize];

        // Wait for threads to finish and merge their data.
        for handle in handles {
            let (start, data) = handle.join().unwrap()?;
            let end = start as usize + data.len();
            file_data[start as usize..end].copy_from_slice(&data);
        }

        pb.finish_with_message("Download complete!");

        // Write the assembled data to the output file.
        let mut out_file = File::create(output)?;
        out_file.write_all(&file_data)?;

        println!("Download complete!");

        Ok(())
    })().map_err(|e| e.to_string())
}

