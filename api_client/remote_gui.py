# import time
# import sys
# import os
# import threading
# import tkinter as tk
# from tkinter import messagebox, scrolledtext

# sys.path.append(os.path.abspath('.'))
# from src.RemoteControl import RemoteControl

# HOST = '192.168.4.245'  # The smartphone's IP address

# class RemoteControlGUI:
#     def __init__(self, master):
#         self.master = master
#         master.title("Remote Video Control")

#         self.remote = None
#         self.recording = False

#         self.status_area = scrolledtext.ScrolledText(master, height=10, width=50, state='disabled')
#         self.status_area.pack(padx=10, pady=10)

#         self.start_button = tk.Button(master, text="Start Recording", command=self.start_recording)
#         self.start_button.pack(padx=10, pady=5)

#         self.stop_button = tk.Button(master, text="Stop Recording", command=self.stop_recording, state=tk.DISABLED)
#         self.stop_button.pack(padx=10, pady=5)

#         self.quit_button = tk.Button(master, text="Quit", command=master.quit)
#         self.quit_button.pack(pady=10)

#     def log(self, message):
#         self.status_area.config(state='normal')
#         self.status_area.insert(tk.END, message + "\n")
#         self.status_area.see(tk.END)
#         self.status_area.config(state='disabled')
#         print(message)

#     def start_recording(self):
#         def thread_func():
#             try:
#                 self.remote = RemoteControl(HOST)
#                 self.log("Connected to device.")

#                 phase, duration, exp_time = self.remote.start_video()
#                 self.log(f"Started video: exposure {exp_time}, duration {duration:.2f}")
#                 self.recording = True

#                 self.start_button.config(state=tk.DISABLED)
#                 self.stop_button.config(state=tk.NORMAL)

#             except Exception as e:
#                 self.log(f"Error starting recording: {e}")
#                 messagebox.showerror("Error", str(e))

#         threading.Thread(target=thread_func).start()

#     def stop_recording(self):
#         def thread_func():
#             try:
#                 if not self.remote:
#                     self.log("Not connected.")
#                     return

#                 self.remote.stop_video()
#                 self.log("Stopped video. Downloading...")

#                 start = time.time()
#                 filename = self.remote.get_video(want_progress_bar=True)
#                 end = time.time()
#                 self.log(f"Video saved to {filename}. Elapsed: {end - start:.2f} seconds")

#                 self.remote.close()
#                 self.log("Connection closed.")

#                 self.start_button.config(state=tk.NORMAL)
#                 self.stop_button.config(state=tk.DISABLED)
#                 self.recording = False

#             except Exception as e:
#                 self.log(f"Error stopping recording: {e}")
#                 messagebox.showerror("Error", str(e))

#         threading.Thread(target=thread_func).start()


# if __name__ == "__main__":
#     root = tk.Tk()
#     app = RemoteControlGUI(root)
#     root.mainloop()

import time
import sys
import os
import threading
import tkinter as tk
import subprocess
import cv2
import mediapipe as mp
from tkinter import messagebox, scrolledtext, filedialog

sys.path.append(os.path.abspath('.'))
from src.RemoteControl import RemoteControl

HOST = '192.168.4.245'  # The smartphone's IP address

class RemoteControlGUI:
    def __init__(self, master):
        self.master = master
        master.title("Remote Video Control")

        self.remote = None
        self.recording = False
        self.save_path = os.getcwd()

        # Logging area
        self.status_area = scrolledtext.ScrolledText(master, height=10, width=50, state='disabled')
        self.status_area.pack(padx=10, pady=10)

        # File name entry
        self.filename_label = tk.Label(master, text="Filename:")
        self.filename_label.pack()
        self.filename_entry = tk.Entry(master, width=40)
        self.filename_entry.insert(0, "recorded_video.mp4")
        self.filename_entry.pack()

        # Folder selection
        self.path_button = tk.Button(master, text="Choose Save Folder", command=self.choose_path)
        self.path_button.pack(pady=5)

        # Start/Stop/Quit buttons
        self.start_button = tk.Button(master, text="Start Recording", command=self.start_recording)
        self.start_button.pack(padx=10, pady=5)

        self.stop_button = tk.Button(master, text="Stop Recording", command=self.stop_recording, state=tk.DISABLED)
        self.stop_button.pack(padx=10, pady=5)

        self.quit_button = tk.Button(master, text="Quit", command=master.quit)
        self.quit_button.pack(pady=10)

        # Play and Analyze buttons
        self.play_button = tk.Button(master, text="Play Video", command=self.play_video)
        self.play_button.pack(pady=5)

        self.pose_button = tk.Button(master, text="Run Pose Estimation", command=self.run_pose_estimation)
        self.pose_button.pack(pady=5)

        self.last_saved_video_path = None


    def log(self, message):
        self.status_area.config(state='normal')
        self.status_area.insert(tk.END, message + "\n")
        self.status_area.see(tk.END)
        self.status_area.config(state='disabled')
        print(message)

    def choose_path(self):
        folder_selected = filedialog.askdirectory(initialdir=self.save_path)
        if folder_selected:
            self.save_path = folder_selected
            self.log(f"Save path set to: {self.save_path}")

    def start_recording(self):
        def thread_func():
            try:
                self.remote = RemoteControl(HOST)
                self.log("Connected to device.")

                phase, duration, exp_time = self.remote.start_video()
                self.log(f"Started video: exposure {exp_time}, duration {duration:.2f}")
                self.recording = True

                self.start_button.config(state=tk.DISABLED)
                self.stop_button.config(state=tk.NORMAL)

            except Exception as e:
                self.log(f"Error starting recording: {e}")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=thread_func).start()

    def stop_recording(self):
        def thread_func():
            try:
                if not self.remote:
                    self.log("Not connected.")
                    return

                self.remote.stop_video()
                self.log("Stopped video. Downloading...")

                start = time.time()
                original_path = self.remote.get_video(want_progress_bar=True)
                end = time.time()
                self.log(f"Video downloaded in {end - start:.2f} seconds")

                # Rename and move to user-defined path
                custom_filename = self.filename_entry.get().strip()
                if not custom_filename.lower().endswith(".mp4"):
                    custom_filename += ".mp4"
                full_save_path = os.path.join(self.save_path, custom_filename)

                os.rename(original_path, full_save_path)
                self.log(f"Video saved to: {full_save_path}")

                self.remote.close()
                self.log("Connection closed.")

                self.start_button.config(state=tk.NORMAL)
                self.stop_button.config(state=tk.DISABLED)
                self.recording = False

            except Exception as e:
                self.log(f"Error stopping recording: {e}")
                messagebox.showerror("Error", str(e))

        threading.Thread(target=thread_func).start()

    def play_video(self):
        if self.last_saved_video_path and os.path.exists(self.last_saved_video_path):
            self.log(f"Playing video: {self.last_saved_video_path}")
            try:
                if sys.platform.startswith('darwin'):
                    subprocess.call(('open', self.last_saved_video_path))
                elif os.name == 'nt':
                    os.startfile(self.last_saved_video_path)
                elif os.name == 'posix':
                    subprocess.call(('xdg-open', self.last_saved_video_path))
            except Exception as e:
                self.log(f"Error opening video: {e}")
        else:
            self.log("No video available to play.")
            messagebox.showinfo("Info", "No video found to play. Record or select a video first.")

    def run_pose_estimation(self):
        if not self.last_saved_video_path or not os.path.exists(self.last_saved_video_path):
            self.log("No video available for pose estimation.")
            messagebox.showinfo("Info", "No video found. Record or select a video first.")
            return

        self.log("Running pose estimation...")

        mp_pose = mp.solutions.pose
        pose = mp_pose.Pose(static_image_mode=False, model_complexity=2)
        mp_drawing = mp.solutions.drawing_utils

        cap = cv2.VideoCapture(self.last_saved_video_path)
        if not cap.isOpened():
            self.log("Error: Cannot open video.")
            return

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = pose.process(image_rgb)

            if results.pose_landmarks:
                mp_drawing.draw_landmarks(frame, results.pose_landmarks, mp_pose.POSE_CONNECTIONS)

            cv2.imshow('Pose Estimation', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break

        cap.release()
        cv2.destroyAllWindows()
        pose.close()
        self.log("Pose estimation completed.")


if __name__ == "__main__":
    root = tk.Tk()
    app = RemoteControlGUI(root)
    root.mainloop()

